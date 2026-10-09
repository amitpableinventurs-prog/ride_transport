// Rider app: onboarding, documents, vehicle, approval and duty status.
import type { Request, Response } from 'express'
import { Types, type HydratedDocument } from 'mongoose'
import { Booking, OPEN_BOOKING_STATUSES } from '../../models/Booking'
import { DocumentRecord } from '../../models/Document'
import type { DriverDocument } from '../../models/Driver'
import { IncentiveScheme } from '../../models/IncentiveScheme'
import { Rating } from '../../models/Rating'
import { ServiceCategory } from '../../models/ServiceCategory'
import { TransportPartner } from '../../models/TransportPartner'
import { Vehicle } from '../../models/Vehicle'
import { VehicleType } from '../../models/VehicleType'
import { Driver } from '../../models/Driver'
import { removeLiveRider } from '../../realtime/socket'
import { rejectOffer } from '../../services/dispatch'
import { activeVehicleFor } from '../../services/trips'
import { serializeAppUser } from '../../utils/appUsers'
import { findServiceArea, haversineKm, parseLatLng } from '../../utils/geo'
import { HttpError, optionalString, parseDate, parsePagination, requireObjectId, requireString } from '../../utils/http'
import { getPlatformSettings } from '../../utils/settings'
import { uploadedFileUrl } from '../../utils/uploads'
import { getOrCreateWallet } from '../../utils/wallet'

// A driving licence (unless the rider chose "No licence") and one of Aadhaar / PAN are needed for approval.
export const REQUIRED_RIDER_DOCUMENTS = ['driving_license'] as const
const IDENTITY_DOCUMENTS = ['aadhaar', 'pan'] as const
const OPTIONAL_RIDER_DOCUMENTS = ['vehicle_rc', 'vehicle_insurance', 'pollution_certificate', 'permit', 'police_verification'] as const
const RIDER_DOCUMENT_TYPES: readonly string[] = [...REQUIRED_RIDER_DOCUMENTS, ...IDENTITY_DOCUMENTS, ...OPTIONAL_RIDER_DOCUMENTS]
const EXPIRING_DOCUMENTS: readonly string[] = ['vehicle_insurance', 'pollution_certificate', 'permit']
// Two-sided documents: the licence back is mandatory ("upload the back side even if it is blank").
const BACK_REQUIRED_DOCUMENTS: readonly string[] = ['driving_license']
const BACK_ALLOWED_DOCUMENTS: readonly string[] = ['driving_license', 'vehicle_rc', 'aadhaar']

const HEATMAP_RADIUS_KM = 10
const HEATMAP_WINDOW_MIN = 60
const HEATMAP_CELL_DEG = 0.01 // about 1.1 km

type DriverDoc = HydratedDocument<DriverDocument>

function driverDoc(req: Request): DriverDoc {
  return req.appUser!.doc as DriverDoc
}

// ---------- Onboarding ----------

const LICENSE_CHOICES = [
  { hasLicense: true, title: 'Yes', description: 'Get Bike Taxi + Delivery Orders', modes: ['ride', 'transport'] },
  { hasLicense: false, title: 'No', description: 'Only Delivery Orders', modes: ['transport'] },
] as const

// GET /onboarding/options: vehicle types and services to choose from, plus what was saved.
export async function getOnboardingOptions(req: Request, res: Response) {
  const [vehicleTypes, services] = await Promise.all([
    VehicleType.find({ status: 'active' }).select('name serviceMode capacityLabel').sort({ serviceMode: 1, name: 1 }),
    ServiceCategory.find({ status: 'active' }).select('key mode name description icon vehicleType').sort({ mode: 1, sortOrder: 1 }),
  ])
  res.json({
    licenseChoices: LICENSE_CHOICES,
    vehicleTypes,
    services,
    documentTypes: { required: REQUIRED_RIDER_DOCUMENTS, oneOf: IDENTITY_DOCUMENTS, optional: OPTIONAL_RIDER_DOCUMENTS },
    current: driverDoc(req).onboarding ?? null,
  })
}

// PUT /onboarding/license { hasLicense }: the "Do you have a Driving License?" screen.
// Without a licence the rider can only take delivery (transport) orders and skips the licence upload.
export async function setLicenseChoice(req: Request, res: Response) {
  const driver = driverDoc(req)
  const hasLicense = (req.body ?? {}).hasLicense
  if (typeof hasLicense !== 'boolean') throw new HttpError(400, 'hasLicense must be true or false')
  if (driver.approvalStatus === 'verified') throw new HttpError(409, 'Your account is already approved')

  driver.set('onboarding.hasLicense', hasLicense)
  // Ride services need a licence: drop any that were chosen before.
  if (!hasLicense && driver.onboarding?.services?.length) {
    const rideKeys = (await ServiceCategory.find({ key: { $in: driver.onboarding.services }, mode: 'ride' }).select('key')).map((c) => c.key)
    driver.set('onboarding.services', driver.onboarding.services.filter((s) => !rideKeys.includes(s)))
  }
  await driver.save()
  const choice = LICENSE_CHOICES.find((c) => c.hasLicense === hasLicense)!
  res.json({ hasLicense, modes: choice.modes, services: await ServiceCategory.find({ status: 'active', mode: { $in: choice.modes } }).select('key mode name icon').sort({ mode: 1, sortOrder: 1 }) })
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

  if (body.hasLicense !== undefined && typeof body.hasLicense !== 'boolean') throw new HttpError(400, 'hasLicense must be true or false')
  const hasLicense = (body.hasLicense as boolean | undefined) ?? driver.onboarding?.hasLicense

  const services = Array.isArray(body.services) ? [...new Set(body.services.filter((s): s is string => typeof s === 'string'))] : []
  if (!services.length) throw new HttpError(400, 'Choose at least one service')
  const categories = await ServiceCategory.find({ key: { $in: services }, status: 'active' }).select('key mode')
  const unknown = services.filter((s) => !categories.some((c) => c.key === s))
  if (unknown.length) throw new HttpError(400, `Unknown services: ${unknown.join(', ')}`)
  if (hasLicense === false && categories.some((c) => c.mode === 'ride')) throw new HttpError(400, 'Without a driving licence you can only choose delivery services')

  if (body.serviceType !== undefined) {
    if (body.serviceType !== 'rider' && body.serviceType !== 'transport') throw new HttpError(400, 'serviceType must be rider or transport')
    driver.serviceType = body.serviceType
  }
  driver.set('onboarding', { riderType, partner: partner?._id ?? null, vehicleType: vehicleType._id, services, hasLicense, completedAt: new Date() })
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

/** Cleans and checks the number typed on a document screen (e.g. "MP09 2023 0022590", "1234 5677 8990"). */
function normalizeDocNumber(docType: string, raw: string): string {
  const value = raw.toUpperCase().replace(/[\s-]/g, '')
  const rules: Record<string, [RegExp, string]> = {
    driving_license: [/^[A-Z]{2}\d{2}[A-Z0-9]{9,13}$/, 'Enter a valid driving licence number, e.g. KA12345677899029'],
    aadhaar: [/^\d{12}$/, 'Aadhaar number must be 12 digits'],
    pan: [/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN, e.g. ABCDE1234F'],
  }
  const rule = rules[docType]
  if (rule && !rule[0].test(value)) throw new HttpError(400, rule[1])
  return value
}

// POST /documents (multipart: file, backFile, docType, docNumber, expiryDate)
export async function uploadDocument(req: Request, res: Response) {
  const driver = driverDoc(req)
  const body = req.body as Record<string, unknown>
  const docType = requireString(body.docType, 'docType', 40)
  if (!RIDER_DOCUMENT_TYPES.includes(docType)) throw new HttpError(400, `docType must be one of: ${RIDER_DOCUMENT_TYPES.join(', ')}`)
  if (docType === 'driving_license' && driver.onboarding?.hasLicense === false) throw new HttpError(409, 'You chose "No driving licence", so no licence is needed')

  const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>
  const front = files.file?.[0]
  const back = files.backFile?.[0]
  if (!front) throw new HttpError(400, 'file (front side) is required')
  if (BACK_REQUIRED_DOCUMENTS.includes(docType) && !back) throw new HttpError(400, 'backFile is required: upload the back side even if it is blank')
  if (back && !BACK_ALLOWED_DOCUMENTS.includes(docType)) throw new HttpError(400, 'This document has no back side')

  const docNumber = normalizeDocNumber(docType, requireString(body.docNumber, 'docNumber', 40))
  const expiryDate = parseDate(body.expiryDate, 'expiryDate')
  if (EXPIRING_DOCUMENTS.includes(docType) && !expiryDate) throw new HttpError(400, 'expiryDate is required for this document')
  if (expiryDate && expiryDate < new Date()) throw new HttpError(400, 'This document has already expired')

  // Re-uploading a document type replaces it and sends it back for review.
  const doc = await DocumentRecord.findOneAndUpdate(
    { ownerType: 'driver', ownerId: driver._id, docType },
    {
      $set: { fileUrl: uploadedFileUrl('documents', front), docNumber, expiryDate, status: 'pending', ...(back ? { backUrl: uploadedFileUrl('documents', back) } : {}) },
      $unset: { rejectionReason: 1, reviewedBy: 1, reviewedAt: 1, ...(back ? {} : { backUrl: 1 }) },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  res.status(201).json(doc)
}

// GET /documents
export async function listDocuments(req: Request, res: Response) {
  const driver = driverDoc(req)
  const byType = await latestDocuments(driver._id)
  const needsLicense = driver.onboarding?.hasLicense !== false
  res.json({
    items: [...byType.values()],
    required: [
      ...(needsLicense ? REQUIRED_RIDER_DOCUMENTS : []).map((type) => ({ docType: type, status: byType.get(type)?.status ?? 'missing' })),
      { docType: 'aadhaar_or_pan', status: bestStatus(IDENTITY_DOCUMENTS.map((t) => byType.get(t)?.status)) ?? 'missing' },
    ],
    allowedTypes: RIDER_DOCUMENT_TYPES,
    backSide: { required: BACK_REQUIRED_DOCUMENTS, optional: BACK_ALLOWED_DOCUMENTS.filter((t) => !BACK_REQUIRED_DOCUMENTS.includes(t)) },
  })
}

type ChecklistStatus = 'not_submitted' | 'selected' | 'under_review' | 'verified' | 'rejected'

const STATUS_RANK: Record<string, number> = { verified: 3, pending: 2, rejected: 1, expired: 1 }
/** Best of several document statuses (the rider only needs one of Aadhaar / PAN). */
function bestStatus(statuses: (string | undefined)[]): string | undefined {
  return statuses.filter((s): s is string => Boolean(s)).sort((a, b) => (STATUS_RANK[b] ?? 0) - (STATUS_RANK[a] ?? 0))[0]
}
function checklistStatus(status: string | undefined): ChecklistStatus {
  if (!status) return 'not_submitted'
  if (status === 'verified') return 'verified'
  if (status === 'pending') return 'under_review'
  return 'rejected'
}

/** The "Documents under verification" screen: one row per onboarding step. */
async function buildChecklist(driver: DriverDoc) {
  const byType = await latestDocuments(driver._id)
  const [vehicleType, vehicle] = await Promise.all([
    driver.onboarding?.vehicleType ? VehicleType.findById(driver.onboarding.vehicleType).select('name') : null,
    Vehicle.findOne({ ownerType: 'driver', ownerId: driver._id }).sort({ createdAt: -1 }),
  ])

  let vehicleNumberStatus: ChecklistStatus = 'not_submitted'
  if (vehicle) vehicleNumberStatus = vehicle.status === 'active' ? 'verified' : vehicle.status === 'blocked' || vehicle.documentsStatus === 'rejected' ? 'rejected' : 'under_review'

  const reasonFor = (types: readonly string[]) => {
    const d = types.map((t) => byType.get(t)).find((x) => x && (x.status === 'rejected' || x.status === 'expired'))
    return d ? (d.status === 'expired' ? 'Document expired' : d.rejectionReason || 'Rejected') : undefined
  }
  const identityStatus = checklistStatus(bestStatus(IDENTITY_DOCUMENTS.map((t) => byType.get(t)?.status)))

  const photoNameDone = Boolean(driver.name && driver.photoUrl && driver.gender && driver.dateOfBirth)
  const items = [
    { key: 'vehicle', title: vehicleType ? `Vehicle - ${vehicleType.name}` : 'Vehicle', status: (vehicleType ? 'selected' : 'not_submitted') as ChecklistStatus },
    ...(driver.onboarding?.hasLicense === false
      ? []
      : [{ key: 'driving_license', title: 'Driving License', status: checklistStatus(byType.get('driving_license')?.status), reason: reasonFor(['driving_license']) }]),
    { key: 'photo_name', title: 'Photo and name', status: (photoNameDone ? 'verified' : 'not_submitted') as ChecklistStatus },
    { key: 'vehicle_number', title: 'Vehicle Number', status: vehicleNumberStatus },
    { key: 'identity', title: 'Aadhaar or PAN card', status: identityStatus, reason: identityStatus === 'rejected' ? reasonFor(IDENTITY_DOCUMENTS) : undefined },
  ]
  return { items, photoNameDone, byType }
}

// GET /onboarding/status: checklist for the "Documents under verification" screen.
export async function getOnboardingStatus(req: Request, res: Response) {
  const driver = driverDoc(req)
  const { items } = await buildChecklist(driver)
  const incomplete = items.some((i) => i.status === 'not_submitted' || i.status === 'rejected')

  const overall = driver.approvalStatus === 'verified' ? 'approved' : driver.approvalStatus === 'rejected' ? 'rejected' : incomplete ? 'pending' : 'under_review'
  const next = items.find((i) => i.status === 'not_submitted' || i.status === 'rejected')
  res.json({
    status: overall,
    title: overall === 'approved' ? 'You are approved' : overall === 'rejected' ? 'Verification failed' : incomplete ? 'Complete your documents' : 'Documents under verification',
    message: overall === 'under_review' ? 'This may take up to 24 hours. Please wait!' : driver.rejectionReason || null,
    items,
    nextStep: overall === 'approved' || overall === 'under_review' ? null : (next?.key ?? null),
    hasLicense: driver.onboarding?.hasLicense ?? null,
  })
}

// GET /approval-status
export async function getApprovalStatus(req: Request, res: Response) {
  const driver = driverDoc(req)
  const { items, photoNameDone, byType } = await buildChecklist(driver)
  const rejectedDocuments = [...byType.values()].filter((d) => d.status === 'rejected' || d.status === 'expired')
  const missing = items.filter((i) => i.status === 'not_submitted').map((i) => i.key)
  const onboardingComplete = Boolean(driver.onboarding?.completedAt)

  let status: 'pending' | 'under_review' | 'approved' | 'rejected'
  if (driver.approvalStatus === 'verified') status = 'approved'
  else if (driver.approvalStatus === 'rejected') status = 'rejected'
  else if (!onboardingComplete || missing.length || rejectedDocuments.length || items.some((i) => i.status === 'rejected')) status = 'pending'
  else status = 'under_review'

  const reasons = [
    ...(driver.approvalStatus === 'rejected' && driver.rejectionReason ? [driver.rejectionReason] : []),
    ...rejectedDocuments.map((d) => `${d.docType}: ${d.status === 'expired' ? 'expired' : d.rejectionReason || 'rejected'}`),
  ]
  res.json({
    status,
    reasons,
    steps: { profileComplete: photoNameDone, onboardingComplete, missingDocuments: missing, documentsToReupload: rejectedDocuments.map((d) => d.docType) },
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

// POST /vehicle (JSON or multipart with rcFront, rcBack): the "Vehicle Number" screen.
// Only registrationNumber is needed once onboarding picked the vehicle type and services. Before approval,
// sending it again corrects the pending request. After approval it files a change request.
export async function requestVehicle(req: Request, res: Response) {
  const driver = driverDoc(req)
  const body = req.body as Record<string, unknown>
  const vehicleTypeId = body.vehicleTypeId ?? driver.onboarding?.vehicleType
  if (!vehicleTypeId) throw new HttpError(400, 'Choose your vehicle type first (POST /onboarding) or send vehicleTypeId')
  const vehicleType = await VehicleType.findOne({ _id: requireObjectId(String(vehicleTypeId), 'vehicleTypeId'), status: 'active' })
  if (!vehicleType) throw new HttpError(400, 'Unknown vehicle type')

  // Category: the one sent, else the chosen service that uses this vehicle type, else any chosen service of the same mode.
  let category = null
  if (body.categoryKey !== undefined) {
    category = await ServiceCategory.findOne({ key: requireString(body.categoryKey, 'categoryKey', 60), status: 'active' })
  } else {
    const chosen = await ServiceCategory.find({ key: { $in: driver.onboarding?.services ?? [] }, status: 'active', mode: vehicleType.serviceMode }).sort({ sortOrder: 1 })
    category = chosen.find((c) => c.vehicleType?.equals(vehicleType._id)) ?? chosen[0] ?? null
  }
  if (!category || category.mode !== vehicleType.serviceMode) throw new HttpError(400, `categoryKey must be an active ${vehicleType.serviceMode} category`)

  const registrationNumber = requireString(body.registrationNumber, 'registrationNumber', 20).toUpperCase().replace(/[\s-]+/g, '')
  if (!/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}$/.test(registrationNumber)) throw new HttpError(400, 'Enter a valid registration number, e.g. MH12AB1234')

  const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>
  const rcFront = files.rcFront?.[0]
  const rcBack = files.rcBack?.[0]
  if (rcBack && !rcFront) throw new HttpError(400, 'rcFront is required when rcBack is sent')

  const pending = await Vehicle.findOne({ ownerType: 'driver', ownerId: driver._id, status: 'inactive' })
  if (pending && driver.approvalStatus === 'verified') throw new HttpError(409, 'You already have a vehicle request under review')
  const taken = await Vehicle.findOne({ registrationNumber, ...(pending ? { _id: { $ne: pending._id } } : {}) }).select('_id')
  if (taken) throw new HttpError(409, 'This vehicle number is already registered')

  const fields = {
    registrationNumber,
    model: optionalString(body.model, 60) ?? vehicleType.name,
    manufacturer: optionalString(body.manufacturer, 60),
    vehicleType: vehicleType._id,
    serviceMode: vehicleType.serviceMode,
    categoryKey: category.key,
    capacity: vehicleType.capacityLabel,
    status: 'inactive' as const,
    documentsStatus: 'pending' as const,
  }
  const vehicle = pending
    ? await Vehicle.findByIdAndUpdate(pending._id, { $set: fields }, { new: true })
    : await Vehicle.create({ ...fields, ownerType: 'driver', ownerId: driver._id, ownerModel: 'Driver' })

  if (rcFront) {
    await DocumentRecord.findOneAndUpdate(
      { ownerType: 'driver', ownerId: driver._id, docType: 'vehicle_rc' },
      {
        $set: { fileUrl: uploadedFileUrl('documents', rcFront), docNumber: registrationNumber, status: 'pending', ...(rcBack ? { backUrl: uploadedFileUrl('documents', rcBack) } : {}) },
        $unset: { rejectionReason: 1, reviewedBy: 1, reviewedAt: 1, ...(rcBack ? {} : { backUrl: 1 }) },
      },
      { upsert: true, setDefaultsOnInsert: true },
    )
  }
  res.status(pending ? 200 : 201).json(vehicle)
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

// ---------- Profile screen ----------

const DAY_MS = 86_400_000
const oneDecimal = (n: number) => Math.round(n * 10) / 10

/** Rider ID printed on the ID card: AZR + the last 6 characters of the account id. */
function riderCode(driver: DriverDoc) {
  return `AZR${driver.id.slice(-6).toUpperCase()}`
}

// GET /profile and /auth/me: the account plus what the My Profile screen shows
// (rating, orders, years with us), the current vehicle and the ID card details.
export async function getProfile(req: Request, res: Response) {
  const driver = driverDoc(req)
  const [ratingCount, vehicle, partner] = await Promise.all([
    Rating.countDocuments({ driver: driver._id, ratedBy: 'customer' }),
    activeVehicleFor(driver._id, driver.assignedVehicle).then((v) =>
      v ? v.populate<{ vehicleType: { name: string } | null }>('vehicleType', 'name') : null,
    ),
    driver.onboarding?.partner ? TransportPartner.findById(driver.onboarding.partner).select('companyName') : null,
  ])
  const vehicleInfo = vehicle
    ? {
        id: vehicle.id as string,
        registrationNumber: vehicle.registrationNumber,
        model: vehicle.model,
        manufacturer: vehicle.manufacturer ?? null,
        vehicleType: vehicle.vehicleType?.name ?? null,
        serviceMode: vehicle.serviceMode,
      }
    : null

  res.json({
    ...serializeAppUser(req.appUser!),
    riderCode: riderCode(driver),
    stats: {
      // rating 0 with ratingCount 0 means "not rated yet" (the app shows --).
      rating: oneDecimal(driver.rating),
      ratingCount,
      orders: driver.totalTrips,
      yearsOnPlatform: Math.floor(((Date.now() - driver.createdAt.getTime()) / (365.25 * DAY_MS)) * 10) / 10,
      memberSince: driver.createdAt,
    },
    vehicle: vehicleInfo,
    partner: partner ? { id: partner.id, companyName: partner.companyName } : null,
    idCard: {
      riderCode: riderCode(driver),
      name: driver.name,
      phone: driver.phone,
      photoUrl: driver.photoUrl ?? null,
      services: driver.onboarding?.services ?? [],
      vehicleNumber: vehicleInfo?.registrationNumber ?? null,
      vehicleType: vehicleInfo?.vehicleType ?? null,
      partnerName: partner?.companyName ?? null,
      memberSince: driver.createdAt,
      verified: driver.approvalStatus === 'verified',
    },
  })
}

// GET /performance?days=7: trips, earnings and ratings for the period, plus lifetime acceptance and cancellation rates.
export async function getPerformance(req: Request, res: Response) {
  const driver = driverDoc(req)
  const days = Math.min(90, Math.max(1, parseInt(String(req.query.days ?? '7'), 10) || 7))
  const from = new Date(Date.now() - days * DAY_MS)
  const driverId = new Types.ObjectId(driver.id)

  const [period, periodRatings, assigned, declinedOrCancelled] = await Promise.all([
    Booking.aggregate<{ trips: number; earnings: number; distanceKm: number }>([
      { $match: { driver: driverId, status: 'completed', completedAt: { $gte: from } } },
      {
        $group: {
          _id: null,
          trips: { $sum: 1 },
          earnings: { $sum: { $ifNull: ['$settlement.riderEarning', 0] } },
          distanceKm: { $sum: { $ifNull: ['$distanceKm', 0] } },
        },
      },
    ]),
    Rating.aggregate<{ avg: number; count: number }>([
      { $match: { driver: driverId, ratedBy: 'customer', createdAt: { $gte: from } } },
      { $group: { _id: null, avg: { $avg: '$score' }, count: { $sum: 1 } } },
    ]),
    Booking.countDocuments({ driver: driverId }),
    Booking.countDocuments({ rejectedBy: driverId }),
  ])

  // rejectedBy holds declined and timed-out offers plus the trips the rider cancelled after accepting.
  const accepted = assigned + driver.cancellations
  // Every rider cancellation is also in rejectedBy; max() keeps older or imported data from going over 100%.
  const offers = assigned + Math.max(declinedOrCancelled, driver.cancellations)
  const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null)
  const p = period[0]
  const r = periodRatings[0]

  res.json({
    days,
    from,
    period: {
      trips: p?.trips ?? 0,
      earnings: Math.round((p?.earnings ?? 0) * 100) / 100,
      distanceKm: Math.round((p?.distanceKm ?? 0) * 10) / 10,
      rating: r ? Math.round(r.avg * 10) / 10 : null,
      ratingCount: r?.count ?? 0,
    },
    lifetime: {
      rating: oneDecimal(driver.rating),
      orders: driver.totalTrips,
      cancellations: driver.cancellations,
      // null until the rider has had an offer / accepted a trip.
      acceptanceRate: percent(accepted, offers),
      cancellationRate: percent(driver.cancellations, accepted),
    },
  })
}

// GET /ratings?page=&limit=: what customers rated this rider ("RATING >" on the profile screen).
export async function listRatings(req: Request, res: Response) {
  const driver = driverDoc(req)
  const { page, limit, skip } = parsePagination(req)
  const filter = { driver: driver._id, ratedBy: 'customer' }
  const [items, total, breakdown] = await Promise.all([
    Rating.find(filter)
      .select('score comment booking createdAt')
      .populate<{ booking: { bookingCode?: string } | null }>('booking', 'bookingCode')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Rating.countDocuments(filter),
    Rating.aggregate<{ _id: number; count: number }>([{ $match: filter }, { $group: { _id: '$score', count: { $sum: 1 } } }]),
  ])
  res.json({
    average: oneDecimal(driver.rating),
    total,
    breakdown: Object.fromEntries([5, 4, 3, 2, 1].map((s) => [s, breakdown.find((b) => b._id === s)?.count ?? 0])),
    items: items.map((r) => ({
      id: r.id,
      score: r.score,
      comment: r.comment ?? null,
      bookingCode: r.booking?.bookingCode ?? null,
      createdAt: r.createdAt,
    })),
    page,
    limit,
  })
}

// DELETE /account { reason? }: the Delete Account button. Records the request; an admin completes the deletion.
export async function requestAccountDeletion(req: Request, res: Response) {
  const driver = driverDoc(req)
  const open = await Booking.exists({ driver: driver._id, status: { $in: [...OPEN_BOOKING_STATUSES, 'scheduled'] } })
  if (open) throw new HttpError(409, 'Finish your current trip before deleting your account')
  const wallet = await getOrCreateWallet('driver', driver._id)
  if (wallet.balance < 0) throw new HttpError(409, `Clear your dues of ₹${Math.abs(wallet.balance).toFixed(2)} before deleting your account`)

  driver.set({ deletionRequestedAt: new Date(), deletionReason: optionalString((req.body ?? {}).reason, 500), onlineStatus: 'offline' })
  await driver.save()
  removeLiveRider(driver._id)
  // Pass on any request currently offered to this rider.
  const offered = await Booking.find({ status: 'requested', 'offer.driver': driver._id }).select('_id')
  await Promise.all(offered.map((b) => rejectOffer(b.id, driver.id)))
  res.status(202).json({ message: 'Your account deletion request has been received. It will be completed within 7 days.' })
}
