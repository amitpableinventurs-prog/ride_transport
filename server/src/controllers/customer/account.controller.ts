// Customer app: saved places, SOS contacts, service availability, coupons, offers, account.
import type { Request, Response } from 'express'
import type { HydratedDocument } from 'mongoose'
import { Banner } from '../../models/Banner'
import { Booking, OPEN_BOOKING_STATUSES } from '../../models/Booking'
import { Coupon } from '../../models/Coupon'
import { SAVED_PLACE_LABELS, type CustomerDocument } from '../../models/Customer'
import { Driver } from '../../models/Driver'
import { ServiceCategory } from '../../models/ServiceCategory'
import { Vehicle } from '../../models/Vehicle'
import { applyCoupon } from '../../utils/coupons'
import { etaMinutes, findServiceArea, haversineKm, parseLatLng, parsePlace, type LatLng } from '../../utils/geo'
import { HttpError, optionalString, parseAmount, requireString } from '../../utils/http'
import { normalizeIndianMobile } from '../../utils/phone'
import { getPlatformSettings } from '../../utils/settings'

const MAX_SAVED_PLACES = 10
const MAX_EMERGENCY_CONTACTS = 3
const RIDER_LOCATION_FRESH_MS = 5 * 60 * 1000

function customerDoc(req: Request): HydratedDocument<CustomerDocument> {
  return req.appUser!.doc as HydratedDocument<CustomerDocument>
}

// ---------- Saved places ----------

// GET /saved-places
export async function listSavedPlaces(req: Request, res: Response) {
  res.json(customerDoc(req).savedPlaces)
}

// POST /saved-places: Home and Work are unique (saving a new one replaces the old).
export async function addSavedPlace(req: Request, res: Response) {
  const customer = customerDoc(req)
  const body = req.body as Record<string, unknown>
  const label = body.label as (typeof SAVED_PLACE_LABELS)[number]
  if (!SAVED_PLACE_LABELS.includes(label)) throw new HttpError(400, `label must be one of: ${SAVED_PLACE_LABELS.join(', ')}`)
  const place = parsePlace(body, 'place')
  const address = requireString(body.address, 'address', 300)
  const name = label === 'other' ? requireString(body.name, 'name', 50) : optionalString(body.name, 50)

  if (label !== 'other') customer.savedPlaces.pull(...customer.savedPlaces.filter((p) => p.label === label).map((p) => p._id))
  if (customer.savedPlaces.length >= MAX_SAVED_PLACES) throw new HttpError(400, `You can save up to ${MAX_SAVED_PLACES} places`)

  customer.savedPlaces.push({ label, name, address, lat: place.lat, lng: place.lng })
  await customer.save()
  res.status(201).json(customer.savedPlaces[customer.savedPlaces.length - 1])
}

// DELETE /saved-places/:id
export async function deleteSavedPlace(req: Request, res: Response) {
  const customer = customerDoc(req)
  const place = customer.savedPlaces.id(req.params.id)
  if (!place) throw new HttpError(404, 'Saved place not found')
  place.deleteOne()
  await customer.save()
  res.status(204).send()
}

// ---------- Emergency (SOS) contacts ----------

function contactsOf(customer: HydratedDocument<CustomerDocument>) {
  if (customer.emergencyContacts.length) return customer.emergencyContacts
  return customer.emergencyContact ? [customer.emergencyContact] : []
}

// GET /emergency-contacts
export async function getEmergencyContacts(req: Request, res: Response) {
  res.json({ contacts: contactsOf(customerDoc(req)), max: MAX_EMERGENCY_CONTACTS })
}

// PUT /emergency-contacts: replaces the whole list (1-3 contacts). The first is the Profile screen's contact.
export async function putEmergencyContacts(req: Request, res: Response) {
  const customer = customerDoc(req)
  const raw = (req.body as { contacts?: unknown }).contacts
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_EMERGENCY_CONTACTS) {
    throw new HttpError(400, `contacts must be a list of 1 to ${MAX_EMERGENCY_CONTACTS} people`)
  }

  const contacts = raw.map((c: { name?: unknown; phone?: unknown }, i) => {
    const name = optionalString(c?.name, 80)
    const phone = normalizeIndianMobile(c?.phone)
    if (!name || name.length < 2 || !phone) throw new HttpError(400, `Contact ${i + 1} needs a name and a valid 10-digit mobile number`)
    if (phone === customer.phone) throw new HttpError(400, 'Emergency contacts must be different from your own number')
    return { name, phone }
  })
  if (new Set(contacts.map((c) => c.phone)).size !== contacts.length) throw new HttpError(400, 'Each contact must have a different phone number')

  customer.set({ emergencyContacts: contacts, emergencyContact: contacts[0] })
  await customer.save()
  res.json({ contacts: customer.emergencyContacts, max: MAX_EMERGENCY_CONTACTS })
}

// ---------- Services at a location ----------

/** Online riders within the dispatch radius and the nearest ETA, per category key. */
export async function nearbyAvailability(point: LatLng, radiusKm: number, categoryKeys: string[]) {
  const riders = await Driver.find({
    status: 'active',
    approvalStatus: 'verified',
    onlineStatus: 'online',
    'currentLocation.updatedAt': { $gte: new Date(Date.now() - RIDER_LOCATION_FRESH_MS) },
  }).select('currentLocation onboarding.services')
  const nearby = riders.filter((r) => haversineKm(point, { lat: r.currentLocation!.lat!, lng: r.currentLocation!.lng! }) <= radiusKm)
  const vehicles = await Vehicle.find({ ownerType: 'driver', ownerId: { $in: nearby.map((r) => r._id) }, status: 'active' }).select('ownerId categoryKey')

  return new Map(
    categoryKeys.map((key) => {
      const eligible = nearby.filter((r) => r.onboarding?.services?.includes(key) || vehicles.some((v) => v.ownerId.equals(r._id) && v.categoryKey === key))
      const etas = eligible.map((r) => etaMinutes({ lat: r.currentLocation!.lat!, lng: r.currentLocation!.lng! }, point))
      return [key, { ridersNearby: eligible.length, etaMin: etas.length ? Math.min(...etas) : null }] as const
    }),
  )
}

// GET /services?lat=&lng=
export async function listServices(req: Request, res: Response) {
  const point = parseLatLng(req.query.lat, req.query.lng)
  if (!point) throw new HttpError(400, 'lat and lng query parameters are required')

  const [area, settings] = await Promise.all([findServiceArea(point), getPlatformSettings()])
  if (!area) {
    res.json({ serviceable: false, message: "We don't operate at this location yet", serviceArea: null, ride: [], transport: [] })
    return
  }

  const modes = [
    ...(settings.rideServiceEnabled && area.rideEnabled ? ['ride'] : []),
    ...(settings.transportServiceEnabled && area.transportEnabled ? ['transport'] : []),
  ]
  const categories = await ServiceCategory.find({ status: 'active', mode: { $in: modes } }).sort({ sortOrder: 1 })

  const availability = await nearbyAvailability(point, settings.dispatchRadiusKm, categories.map((c) => c.key))
  const items = categories.map((c) => ({
    key: c.key,
    mode: c.mode,
    name: c.name,
    description: c.description,
    icon: c.icon,
    seats: c.seats,
    capacityLabel: c.capacityLabel,
    ...availability.get(c.key)!,
  }))

  res.json({
    serviceable: true,
    serviceArea: { id: area.id, name: area.name, city: area.city },
    ride: items.filter((i) => i.mode === 'ride'),
    transport: items.filter((i) => i.mode === 'transport'),
  })
}

// ---------- Coupons and offers ----------

// POST /coupons/validate
export async function validateCoupon(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  const code = requireString(body.code, 'code', 40)
  const categoryKey = requireString(body.categoryKey, 'categoryKey', 60)
  const fareTotal = parseAmount(body.fareTotal, 'fareTotal', { min: 0 })
  const category = await ServiceCategory.findOne({ key: categoryKey, status: 'active' })
  if (!category) throw new HttpError(400, 'Unknown vehicle category')
  const pickup = body.pickup ? parsePlace(body.pickup, 'pickup') : null
  const area = pickup ? await findServiceArea(pickup) : null

  try {
    const { code: normalized, discount, coupon } = await applyCoupon({
      code,
      customerId: customerDoc(req)._id,
      mode: category.mode,
      categoryKey,
      serviceAreaId: area?._id,
      fareTotal,
    })
    res.json({ valid: true, code: normalized, title: coupon.title, discount, payable: Math.max(0, fareTotal - discount) })
  } catch (err) {
    if (err instanceof HttpError && err.status === 400) {
      res.json({ valid: false, code: code.toUpperCase(), message: err.message })
      return
    }
    throw err
  }
}

// GET /offers
export async function listOffers(_req: Request, res: Response) {
  const now = new Date()
  const [coupons, banners] = await Promise.all([
    Coupon.find({ status: 'active', code: { $exists: true, $ne: null }, validFrom: { $lte: now }, validTo: { $gte: now } })
      .select('code title discountType amount maxDiscount minBookingAmount applicableMode applicableCategories validTo')
      .sort({ validTo: 1 }),
    Banner.find({ status: 'active', startDate: { $lte: now }, endDate: { $gte: now } })
      .select('title description imageUrl ctaLabel targetLink serviceMode')
      .sort({ startDate: -1 }),
  ])
  res.json({ coupons, banners })
}

// ---------- Account ----------

// DELETE /account: records a deletion request; support completes it after settling dues and records.
export async function requestAccountDeletion(req: Request, res: Response) {
  const customer = customerDoc(req)
  const open = await Booking.exists({ customer: customer._id, status: { $in: [...OPEN_BOOKING_STATUSES, 'scheduled'] } })
  if (open) throw new HttpError(409, 'Finish or cancel your ongoing and scheduled bookings before deleting your account')

  customer.set({ deletionRequestedAt: new Date(), deletionReason: optionalString((req.body ?? {}).reason, 500) })
  await customer.save()
  res.status(202).json({ message: 'Your account deletion request has been received. It will be completed within 7 days.' })
}
