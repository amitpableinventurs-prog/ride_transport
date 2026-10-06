// Rider app: onboarding, documents, vehicle, approval and duty status.
import type { Request, Response } from 'express'
import type { HydratedDocument } from 'mongoose'
import { Booking } from '../../models/Booking'
import { DocumentRecord } from '../../models/Document'
import type { DriverDocument } from '../../models/Driver'
import { IncentiveScheme } from '../../models/IncentiveScheme'
import { ServiceCategory } from '../../models/ServiceCategory'
import { TransportPartner } from '../../models/TransportPartner'
import { Vehicle } from '../../models/Vehicle'
import { VehicleType } from '../../models/VehicleType'
import { Driver } from '../../models/Driver'
import { removeLiveRider } from '../../realtime/socket'
import { rejectOffer } from '../../services/dispatch'
import { activeVehicleFor } from '../../services/trips'
import { isProfileComplete } from '../../utils/appUsers'
import { findServiceArea, haversineKm, parseLatLng } from '../../utils/geo'
import { HttpError, optionalString, parseDate, requireObjectId, requireString } from '../../utils/http'
import { getPlatformSettings } from '../../utils/settings'
import { uploadedFileUrl } from '../../utils/uploads'
import { getOrCreateWallet } from '../../utils/wallet'

export const REQUIRED_RIDER_DOCUMENTS = ['driving_license', 'vehicle_rc', 'vehicle_insurance', 'aadhaar'] as const
const OPTIONAL_RIDER_DOCUMENTS = ['pan', 'pollution_certificate', 'permit', 'police_verification'] as const
const RIDER_DOCUMENT_TYPES: readonly string[] = [...REQUIRED_RIDER_DOCUMENTS, ...OPTIONAL_RIDER_DOCUMENTS]
const EXPIRING_DOCUMENTS: readonly string[] = ['driving_license', 'vehicle_insurance', 'pollution_certificate', 'permit']

const HEATMAP_RADIUS_KM = 10
const HEATMAP_WINDOW_MIN = 60
const HEATMAP_CELL_DEG = 0.01 // about 1.1 km

type DriverDoc = HydratedDocument<DriverDocument>

function driverDoc(req: Request): DriverDoc {
  return req.appUser!.doc as DriverDoc
}

// ---------- Onboarding ----------

// GET /onboarding/options: vehicle types and services to choose from, plus what was saved.
export async function getOnboardingOptions(req: Request, res: Response) {
  const [vehicleTypes, services] = await Promise.all([
    VehicleType.find({ status: 'active' }).select('name serviceMode capacityLabel').sort({ serviceMode: 1, name: 1 }),
    ServiceCategory.find({ status: 'active' }).select('key mode name description icon vehicleType').sort({ mode: 1, sortOrder: 1 }),
  ])
  res.json({ vehicleTypes, services, documentTypes: { required: REQUIRED_RIDER_DOCUMENTS, optional: OPTIONAL_RIDER_DOCUMENTS }, current: driverDoc(req).onboarding ?? null })
}

// POST /onboarding: individual or partner-fleet rider, vehicle type and the services they will run.
export async function submitOnboarding(req: Request, res: Response) {
  const driver = driverDoc(req)
  if (driver.approvalStatus === 'verified') throw new HttpError(409, 'Your account is already approved. Use vehicle change requests to update your vehicle.')
  const body = req.body as Record<string, unknown>

  const riderType = body.type
  if (riderType !== 'individual' && riderType !== 'partner') throw new HttpError(400, 'type must be individual or partner')
  let partner = null
  if (riderType === 'partner') {
    partner = await TransportPartner.findOne({ partnerCode: requireString(body.partnerCode, 'partnerCode', 20).toUpperCase(), status: 'active' })
    if (!partner) throw new HttpError(400, 'No active transport partner has this code')
  }

  const vehicleType = await VehicleType.findOne({ _id: requireObjectId(body.vehicleTypeId, 'vehicleTypeId'), status: 'active' })
  if (!vehicleType) throw new HttpError(400, 'Unknown vehicle type')

  const services = Array.isArray(body.services) ? [...new Set(body.services.filter((s): s is string => typeof s === 'string'))] : []
  if (!services.length) throw new HttpError(400, 'Choose at least one service')
  const categories = await ServiceCategory.find({ key: { $in: services }, status: 'active' }).select('key')
  const unknown = services.filter((s) => !categories.some((c) => c.key === s))
  if (unknown.length) throw new HttpError(400, `Unknown services: ${unknown.join(', ')}`)

  if (body.serviceType !== undefined) {
    if (body.serviceType !== 'rider' && body.serviceType !== 'driver') throw new HttpError(400, 'serviceType must be rider or driver')
    driver.serviceType = body.serviceType
  }
  driver.set('onboarding', { riderType, partner: partner?._id ?? null, vehicleType: vehicleType._id, services, completedAt: new Date() })
  // A rejected rider who resubmits goes back into review.
  if (driver.approvalStatus === 'rejected') driver.approvalStatus = 'pending'
  await driver.save()

  res.json({ onboarding: driver.onboarding, partner: partner ? { id: partner.id, companyName: partner.companyName } : null, vehicleType: { id: vehicleType.id, name: vehicleType.name } })
}

// ---------- Documents ----------

async function latestDocuments(driverId: DriverDoc['_id']) {
  const docs = await DocumentRecord.find({ ownerType: 'driver', ownerId: driverId }).sort({ updatedAt: -1 })
  const byType = new Map<string, (typeof docs)[number]>()
  for (const d of docs) if (!byType.has(d.docType)) byType.set(d.docType, d)
  return byType
}

// POST /documents (multipart: file, docType, docNumber, expiryDate)
export async function uploadDocument(req: Request, res: Response) {
  const driver = driverDoc(req)
  const body = req.body as Record<string, unknown>
  const docType = requireString(body.docType, 'docType', 40)
  if (!RIDER_DOCUMENT_TYPES.includes(docType)) throw new HttpError(400, `docType must be one of: ${RIDER_DOCUMENT_TYPES.join(', ')}`)
  if (!req.file) throw new HttpError(400, 'file is required')

  const docNumber = requireString(body.docNumber, 'docNumber', 40).toUpperCase()
  const expiryDate = parseDate(body.expiryDate, 'expiryDate')
  if (EXPIRING_DOCUMENTS.includes(docType) && !expiryDate) throw new HttpError(400, 'expiryDate is required for this document')
  if (expiryDate && expiryDate < new Date()) throw new HttpError(400, 'This document has already expired')

  // Re-uploading a document type replaces it and sends it back for review.
  const doc = await DocumentRecord.findOneAndUpdate(
    { ownerType: 'driver', ownerId: driver._id, docType },
    {
      $set: { fileUrl: uploadedFileUrl('documents', req.file), docNumber, expiryDate, status: 'pending' },
      $unset: { rejectionReason: 1, reviewedBy: 1, reviewedAt: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  res.status(201).json(doc)
}

// GET /documents
export async function listDocuments(req: Request, res: Response) {
  const byType = await latestDocuments(driverDoc(req)._id)
  res.json({
    items: [...byType.values()],
    required: REQUIRED_RIDER_DOCUMENTS.map((type) => ({ docType: type, status: byType.get(type)?.status ?? 'missing' })),
    allowedTypes: RIDER_DOCUMENT_TYPES,
  })
}

// GET /approval-status
export async function getApprovalStatus(req: Request, res: Response) {
  const driver = driverDoc(req)
  const byType = await latestDocuments(driver._id)
  const missingDocuments = REQUIRED_RIDER_DOCUMENTS.filter((t) => !byType.has(t))
  const rejectedDocuments = [...byType.values()].filter((d) => d.status === 'rejected' || d.status === 'expired')
  const onboardingComplete = Boolean(driver.onboarding?.completedAt)
  const profileComplete = isProfileComplete(req.appUser!)

  let status: 'pending' | 'under_review' | 'approved' | 'rejected'
  if (driver.approvalStatus === 'verified') status = 'approved'
  else if (driver.approvalStatus === 'rejected') status = 'rejected'
  else if (!profileComplete || !onboardingComplete || missingDocuments.length || rejectedDocuments.length) status = 'pending'
  else status = 'under_review'

  const reasons = [
    ...(driver.approvalStatus === 'rejected' && driver.rejectionReason ? [driver.rejectionReason] : []),
    ...rejectedDocuments.map((d) => `${d.docType}: ${d.status === 'expired' ? 'expired' : d.rejectionReason || 'rejected'}`),
  ]
  res.json({
    status,
    reasons,
    steps: { profileComplete, onboardingComplete, missingDocuments, documentsToReupload: rejectedDocuments.map((d) => d.docType) },
  })
}

// ---------- Vehicle ----------

// GET /vehicle: the vehicle in use plus pending change requests.
export async function getVehicle(req: Request, res: Response) {
  const driver = driverDoc(req)
  const [current, requests] = await Promise.all([
    activeVehicleFor(driver._id, driver.assignedVehicle),
    Vehicle.find({ ownerType: 'driver', ownerId: driver._id, status: 'inactive' }).populate('vehicleType', 'name capacityLabel').sort({ createdAt: -1 }),
  ])
  res.json({ current: current ? await current.populate('vehicleType', 'name capacityLabel') : null, requests })
}

// POST /vehicle: register a vehicle (or request a change); it goes live after admin verification.
export async function requestVehicle(req: Request, res: Response) {
  const driver = driverDoc(req)
  const body = req.body as Record<string, unknown>
  const vehicleType = await VehicleType.findOne({ _id: requireObjectId(body.vehicleTypeId, 'vehicleTypeId'), status: 'active' })
  if (!vehicleType) throw new HttpError(400, 'Unknown vehicle type')
  const category = await ServiceCategory.findOne({ key: requireString(body.categoryKey, 'categoryKey', 60), status: 'active' })
  if (!category || category.mode !== vehicleType.serviceMode) throw new HttpError(400, `categoryKey must be an active ${vehicleType.serviceMode} category`)

  const registrationNumber = requireString(body.registrationNumber, 'registrationNumber', 20).toUpperCase().replace(/\s+/g, '')
  if (!/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(registrationNumber.replace(/-/g, ''))) throw new HttpError(400, 'Enter a valid registration number, e.g. MH12AB1234')
  if (await Vehicle.exists({ ownerType: 'driver', ownerId: driver._id, status: 'inactive' })) {
    throw new HttpError(409, 'You already have a vehicle request under review')
  }

  const vehicle = await Vehicle.create({
    registrationNumber,
    model: requireString(body.model, 'model', 60),
    manufacturer: optionalString(body.manufacturer, 60),
    vehicleType: vehicleType._id,
    serviceMode: vehicleType.serviceMode,
    categoryKey: category.key,
    ownerType: 'driver',
    ownerId: driver._id,
    ownerModel: 'Driver',
    capacity: vehicleType.capacityLabel,
    status: 'inactive',
    documentsStatus: 'pending',
  })
  res.status(201).json(vehicle)
}

// ---------- Duty ----------

function selfieDueAt(driver: DriverDoc, intervalHours: number): Date | null {
  return driver.lastSelfieAt ? new Date(driver.lastSelfieAt.getTime() + intervalHours * 3_600_000) : null
}

// POST /duty/online
export async function goOnline(req: Request, res: Response) {
  const driver = driverDoc(req)
  if (driver.approvalStatus !== 'verified') throw new HttpError(403, 'Your account is not approved yet', { approvalStatus: driver.approvalStatus })
  if (driver.onlineStatus === 'on_trip') throw new HttpError(409, 'You are on a trip')
  const location = parseLatLng((req.body ?? {}).lat, (req.body ?? {}).lng)
  if (!location) throw new HttpError(400, 'lat and lng are required')

  const settings = await getPlatformSettings()
  const dueAt = selfieDueAt(driver, settings.selfieCheckIntervalHours)
  if (!dueAt || dueAt < new Date()) throw new HttpError(428, 'Please take a selfie to go online', { selfieRequired: true })

  const wallet = await getOrCreateWallet('driver', driver._id)
  if (-wallet.balance > settings.maxCashDues) {
    throw new HttpError(402, `Clear your dues of ₹${-wallet.balance} to go online`, { dues: -wallet.balance, limit: settings.maxCashDues })
  }
  const vehicle = await activeVehicleFor(driver._id, driver.assignedVehicle)
  if (!vehicle) throw new HttpError(409, 'You have no active vehicle. Add one and wait for verification.')

  driver.set({ onlineStatus: 'online', currentLocation: { ...location, updatedAt: new Date() } })
  await driver.save()
  res.json({ onlineStatus: driver.onlineStatus, vehicle: { id: vehicle.id, registrationNumber: vehicle.registrationNumber, categoryKey: vehicle.categoryKey }, selfieDueAt: dueAt })
}

// POST /duty/offline
export async function goOffline(req: Request, res: Response) {
  const driver = driverDoc(req)
  if (driver.onlineStatus === 'on_trip') throw new HttpError(409, 'Finish your current trip before going offline')
  driver.onlineStatus = 'offline'
  await driver.save()
  removeLiveRider(driver._id)

  // Pass on any request currently offered to this rider.
  const offered = await Booking.find({ status: 'requested', 'offer.driver': driver._id }).select('_id')
  await Promise.all(offered.map((b) => rejectOffer(b.id, driver.id)))
  res.json({ onlineStatus: driver.onlineStatus })
}

// POST /selfie-check (multipart: selfie)
// No face-match provider is integrated yet: the selfie is stored for admin review and the check passes.
export async function selfieCheck(req: Request, res: Response) {
  const driver = driverDoc(req)
  if (!req.file) throw new HttpError(400, 'selfie image is required')
  const settings = await getPlatformSettings()
  driver.set({ selfieUrl: uploadedFileUrl('selfies', req.file), lastSelfieAt: new Date() })
  await driver.save()
  res.json({ verified: true, faceMatch: 'not_configured', selfieUrl: driver.selfieUrl, nextCheckDueAt: selfieDueAt(driver, settings.selfieCheckIntervalHours) })
}

// ---------- Incentives and demand ----------

// GET /incentives
export async function listIncentives(req: Request, res: Response) {
  const driver = driverDoc(req)
  const now = new Date()
  const loc = driver.currentLocation
  const area = loc?.lat != null && loc.lng != null ? await findServiceArea({ lat: loc.lat, lng: loc.lng }) : null
  const schemes = await IncentiveScheme.find({
    status: 'active',
    startAt: { $lte: now },
    endAt: { $gte: now },
    serviceArea: { $in: [null, ...(area ? [area._id] : [])] },
  }).sort({ endAt: 1 })

  const items = await Promise.all(
    schemes.map(async (s) => {
      const completedTrips = await Booking.countDocuments({
        driver: driver._id,
        status: 'completed',
        completedAt: { $gte: s.startAt, $lte: s.endAt },
        ...(s.categoryKeys.length ? { categoryKey: { $in: s.categoryKeys } } : {}),
      })
      return { ...s.toJSON(), completedTrips, remainingTrips: Math.max(0, s.targetTrips - completedTrips), achieved: completedTrips >= s.targetTrips }
    }),
  )
  res.json({ items })
}

// GET /heatmap?lat=&lng=: open requests vs online riders per ~1 km cell over the last hour.
export async function getHeatmap(req: Request, res: Response) {
  const driver = driverDoc(req)
  const center =
    parseLatLng(req.query.lat, req.query.lng) ??
    (driver.currentLocation?.lat != null && driver.currentLocation.lng != null ? { lat: driver.currentLocation.lat, lng: driver.currentLocation.lng } : null)
  if (!center) throw new HttpError(400, 'lat and lng are required (or go online to share your location)')

  const since = new Date(Date.now() - HEATMAP_WINDOW_MIN * 60_000)
  const [bookings, riders] = await Promise.all([
    Booking.find({ createdAt: { $gte: since }, status: { $in: ['requested', 'no_rider_found', 'accepted', 'arrived', 'started', 'in_transit', 'completed'] } }).select('pickup'),
    Driver.find({ onlineStatus: 'online', 'currentLocation.updatedAt': { $gte: since } }).select('currentLocation'),
  ])

  const cells = new Map<string, { lat: number; lng: number; demand: number; supply: number }>()
  const cellOf = (lat: number, lng: number) => {
    const cLat = Math.floor(lat / HEATMAP_CELL_DEG) * HEATMAP_CELL_DEG + HEATMAP_CELL_DEG / 2
    const cLng = Math.floor(lng / HEATMAP_CELL_DEG) * HEATMAP_CELL_DEG + HEATMAP_CELL_DEG / 2
    if (haversineKm(center, { lat: cLat, lng: cLng }) > HEATMAP_RADIUS_KM) return null
    const key = `${cLat.toFixed(4)},${cLng.toFixed(4)}`
    if (!cells.has(key)) cells.set(key, { lat: Number(cLat.toFixed(4)), lng: Number(cLng.toFixed(4)), demand: 0, supply: 0 })
    return cells.get(key)!
  }
  for (const b of bookings) {
    const cell = b.pickup?.lat != null && b.pickup.lng != null ? cellOf(b.pickup.lat, b.pickup.lng) : null
    if (cell) cell.demand++
  }
  for (const r of riders) {
    const cell = r.currentLocation?.lat != null && r.currentLocation.lng != null ? cellOf(r.currentLocation.lat, r.currentLocation.lng) : null
    if (cell) cell.supply++
  }

  const zones = [...cells.values()]
    .filter((c) => c.demand > 0)
    .map((c) => ({ ...c, level: c.demand >= 2 * Math.max(1, c.supply) ? 'high' : c.demand > c.supply ? 'medium' : 'low' }))
    .sort((a, b) => b.demand - a.demand)
  res.json({ center, radiusKm: HEATMAP_RADIUS_KM, windowMinutes: HEATMAP_WINDOW_MIN, zones })
}
