// Customer app: saved places, SOS contacts, service availability, coupons, offers, account.
import type { Request, Response } from 'express'
import type { HydratedDocument } from 'mongoose'
import { Banner } from '../../models/Banner'
import { Booking, OPEN_BOOKING_STATUSES } from '../../models/Booking'
import { Coupon } from '../../models/Coupon'
import { CoinTransaction } from '../../models/CoinTransaction'
import { Customer, SAVED_PLACE_LABELS, type CustomerDocument } from '../../models/Customer'
import { Driver } from '../../models/Driver'
import { ServiceCategory } from '../../models/ServiceCategory'
import { Vehicle } from '../../models/Vehicle'
import { applyCoupon } from '../../utils/coupons'
import { boundingBox, etaMinutes, findServiceArea, haversineKm, parseLatLng, parsePlace, type LatLng } from '../../utils/geo'
import { WalletTransaction } from '../../models/WalletTransaction'
import { HttpError, optionalString, parseAmount, parsePagination, requireString } from '../../utils/http'
import { getOrCreateWallet } from '../../utils/wallet'
import { normalizeIndianMobile } from '../../utils/phone'
import { getPlatformSettings } from '../../utils/settings'
import { TtlCache } from '../../utils/cache'

const MAX_SAVED_PLACES = 10
export const MAX_EMERGENCY_CONTACTS = 3
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

export function contactsOf(customer: HydratedDocument<CustomerDocument>) {
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
  // Shared for 10 seconds per ~100 m cell, so many phones opening the Home / Service tab cost one query.
  const key = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}:${radiusKm}:${categoryKeys.join(',')}`
  return availabilityCache.get(key, () => computeAvailability(point, radiusKm, categoryKeys))
}

const availabilityCache = new TtlCache<Awaited<ReturnType<typeof computeAvailability>>>(10_000, 2000)

async function computeAvailability(point: LatLng, radiusKm: number, categoryKeys: string[]) {
  const box = boundingBox(point, radiusKm)
  const riders = await Driver.find({
    'currentLocation.lat': { $gte: box.minLat, $lte: box.maxLat },
    'currentLocation.lng': { $gte: box.minLng, $lte: box.maxLng },
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

// ---------- Profile menu: Payment, My Rewards, anzcabs Coins ----------

// GET /payments/methods: the Payment screen. Online methods go through the payment gateway.
export async function listPaymentMethods(req: Request, res: Response) {
  const wallet = await getOrCreateWallet('customer', customerDoc(req)._id)
  res.json({
    wallet: { balance: wallet.balance, currency: wallet.currency, dues: Math.max(0, -wallet.balance) },
    methods: [
      { key: 'cash', name: 'Cash', available: true },
      { key: 'wallet', name: 'AnZ Cabs Wallet', available: wallet.balance > 0, balance: wallet.balance },
      { key: 'upi', name: 'UPI', available: true },
      { key: 'card', name: 'Credit / Debit Card', available: true },
      { key: 'netbanking', name: 'Net Banking', available: true },
    ],
  })
}

/** Wallet credits shown on My Rewards. */
const REWARD_REASONS = ['referral', 'bonus'] as const
const REWARD_TITLES: Record<(typeof REWARD_REASONS)[number], string> = { referral: 'Referral reward', bonus: 'Bonus from AnZ Cabs' }

// GET /rewards?page=&limit=: My Rewards. Referral rewards and bonuses credited to the wallet, plus the coins balance.
export async function listRewards(req: Request, res: Response) {
  const customer = customerDoc(req)
  const { page, limit, skip } = parsePagination(req)
  const wallet = await getOrCreateWallet('customer', customer._id)
  const filter = { wallet: wallet._id, type: 'credit', reason: { $in: REWARD_REASONS } }
  const [items, total, totals] = await Promise.all([
    WalletTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    WalletTransaction.countDocuments(filter),
    WalletTransaction.aggregate<{ _id: null; amount: number }>([{ $match: filter }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
  ])

  // A referral credit points at the friend who joined (or who invited this customer).
  const friendIds = items.filter((t) => t.reason === 'referral' && t.referenceId).map((t) => t.referenceId!)
  const friends = friendIds.length ? await Customer.find({ _id: { $in: friendIds } }).select('name') : []
  const friendName = (id?: unknown) => friends.find((f) => f._id.equals(id as string))?.name || null

  res.json({
    totalEarned: totals[0]?.amount ?? 0,
    currency: wallet.currency,
    coins: { balance: customer.coins },
    items: items.map((t) => {
      const reason = t.reason as (typeof REWARD_REASONS)[number]
      const friend = reason === 'referral' ? friendName(t.referenceId) : null
      return {
        id: t.id,
        type: reason,
        title: REWARD_TITLES[reason],
        subtitle: friend ? `With ${friend}` : null,
        amount: t.amount,
        createdAt: t.createdAt,
      }
    }),
    total,
    page,
    limit,
  })
}

// GET /coins?page=&limit=: anzcabs Coins balance and history. Earning and redeeming rules are not set up yet.
export async function getCoins(req: Request, res: Response) {
  const customer = customerDoc(req)
  const { page, limit, skip } = parsePagination(req)
  const filter = { customer: customer._id }
  const [items, total] = await Promise.all([
    CoinTransaction.find(filter).select('-customer').sort({ createdAt: -1 }).skip(skip).limit(limit),
    CoinTransaction.countDocuments(filter),
  ])
  res.json({ balance: customer.coins, transactions: { items, total, page, limit } })
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
