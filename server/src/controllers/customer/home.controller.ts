// Customer app Home, Pickup (place search) and Refer & Earn screens.
import type { Request, Response } from 'express'
import type { HydratedDocument } from 'mongoose'
import { Booking, OPEN_BOOKING_STATUSES } from '../../models/Booking'
import { Customer, type CustomerDocument } from '../../models/Customer'
import { findServiceArea, haversineKm, parseLatLng, type LatLng } from '../../utils/geo'
import { HttpError, requireString } from '../../utils/http'
import { ensureReferralCode } from '../../utils/referral'
import { getPlatformSettings } from '../../utils/settings'

type CustomerDoc = HydratedDocument<CustomerDocument>
const customerDoc = (req: Request) => req.appUser!.doc as CustomerDoc

const RECENT_LIMIT = 6
const SAME_PLACE_KM = 0.05
const REVERSE_MATCH_KM = 0.2

interface PlaceItem extends LatLng {
  name: string
  address: string
  /** Saved-place id when the place is a favourite: the heart is filled and DELETE /saved-places/:id un-favourites it. */
  favouriteId: string | null
}

function favouriteFor(customer: CustomerDoc, point: LatLng, address: string) {
  const norm = address.trim().toLowerCase()
  return customer.savedPlaces.find((p) => p.address.trim().toLowerCase() === norm || haversineKm(point, p) <= SAME_PLACE_KM) ?? null
}

/** Latest distinct drop-off places from the customer's past bookings, newest first. */
async function recentPlaces(customer: CustomerDoc, limit: number): Promise<PlaceItem[]> {
  const bookings = await Booking.find({ customer: customer._id, status: { $ne: 'cancelled' }, 'drop.address': { $exists: true, $ne: null } })
    .sort({ createdAt: -1 })
    .limit(limit * 6)
    .select('drop')
  const out: PlaceItem[] = []
  for (const b of bookings) {
    const { address, lat, lng } = b.drop ?? {}
    if (!address || lat == null || lng == null) continue
    const point = { lat, lng }
    if (out.some((p) => p.address.toLowerCase() === address.toLowerCase() || haversineKm(p, point) <= SAME_PLACE_KM)) continue
    out.push({ name: address.split(',')[0].trim(), address, ...point, favouriteId: favouriteFor(customer, point, address)?.id ?? null })
    if (out.length === limit) break
  }
  return out
}

// GET /home?lat=&lng=: everything the Home tab needs in one call. lat/lng are optional.
export async function getHome(req: Request, res: Response) {
  const customer = customerDoc(req)
  const point = parseLatLng(req.query.lat, req.query.lng)
  const [area, active, recent, settings] = await Promise.all([
    point ? findServiceArea(point) : null,
    Booking.findOne({ customer: customer._id, status: { $in: OPEN_BOOKING_STATUSES } }).sort({ createdAt: -1 }).select('bookingCode status mode categoryKey drop'),
    recentPlaces(customer, RECENT_LIMIT),
    getPlatformSettings(),
  ])
  const name = customer.name?.trim() ?? ''
  res.json({
    name,
    firstName: name.split(/\s+/)[0] ?? '',
    initial: name ? name[0].toUpperCase() : '',
    serviceable: point ? Boolean(area) : null,
    city: area?.city ?? customer.city ?? null,
    modes: { ride: settings.rideServiceEnabled && (area?.rideEnabled ?? true), transport: settings.transportServiceEnabled && (area?.transportEnabled ?? true) },
    activeBooking: active ? { id: active.id, bookingCode: active.bookingCode, status: active.status, mode: active.mode, categoryKey: active.categoryKey, drop: active.drop } : null,
    savedPlaces: customer.savedPlaces,
    recentPlaces: recent,
  })
}

// GET /recent-places?limit=
export async function listRecentPlaces(req: Request, res: Response) {
  const limit = Math.min(Math.max(Number(req.query.limit) || RECENT_LIMIT, 1), 20)
  res.json(await recentPlaces(customerDoc(req), limit))
}

// GET /places/search?q=&lat=&lng=: matches the customer's saved and recent places. No maps provider is wired in,
// so the app uses its own Places SDK for the wider map search and this for personal suggestions.
export async function searchPlaces(req: Request, res: Response) {
  const q = requireString(req.query.q, 'q', 100).toLowerCase()
  const customer = customerDoc(req)
  const origin = parseLatLng(req.query.lat, req.query.lng)
  const saved: PlaceItem[] = customer.savedPlaces.map((p) => ({ name: p.name || p.label[0].toUpperCase() + p.label.slice(1), address: p.address, lat: p.lat, lng: p.lng, favouriteId: p.id }))
  const recent = await recentPlaces(customer, 20)
  const seen = new Set<string>()
  const results = [...saved, ...recent]
    .filter((p) => `${p.name} ${p.address}`.toLowerCase().includes(q))
    .filter((p) => !seen.has(p.address.toLowerCase()) && seen.add(p.address.toLowerCase()))
    .map((p) => ({ ...p, distanceKm: origin ? Math.round(haversineKm(origin, p) * 10) / 10 : null }))
  res.json(results.slice(0, 10))
}

// GET /places/reverse?lat=&lng=: the address label under the "Pickup Point" pin. Uses known places within 200 m,
// otherwise only the service-area city, since there is no geocoding provider yet.
export async function reverseGeocode(req: Request, res: Response) {
  const point = parseLatLng(req.query.lat, req.query.lng)
  if (!point) throw new HttpError(400, 'lat and lng query parameters are required')
  const customer = customerDoc(req)
  const [area, recent] = await Promise.all([findServiceArea(point), recentPlaces(customer, 20)])
  const known = [...customer.savedPlaces.map((p) => ({ address: p.address, lat: p.lat, lng: p.lng })), ...recent]
    .map((p) => ({ p, d: haversineKm(point, p) }))
    .filter((x) => x.d <= REVERSE_MATCH_KM)
    .sort((a, b) => a.d - b.d)[0]
  res.json({ ...point, address: known?.p.address ?? null, city: area?.city ?? null, serviceable: Boolean(area) })
}

// ---------- Refer & Earn ----------

// GET /referral
export async function getReferral(req: Request, res: Response) {
  const customer = customerDoc(req)
  const [code, settings, referred] = await Promise.all([
    ensureReferralCode(customer._id),
    getPlatformSettings(),
    Customer.find({ referredBy: customer._id }).sort({ createdAt: -1 }).limit(50).select('name createdAt referralRewardedAt'),
  ])
  const rewarded = referred.filter((r) => r.referralRewardedAt)
  const amount = settings.referralRewardReferrer
  res.json({
    enabled: settings.referralEnabled,
    code,
    title: `Invite friends to ${settings.platformName}`,
    description: 'When a friend completes their first ride, you both get ride credit.',
    shareMessage: `Join ${settings.platformName} and get ₹${settings.referralRewardReferee} ride credit on your first ride. Use my code ${code} when you sign up.`,
    rewardForYou: amount,
    rewardForFriend: settings.referralRewardReferee,
    currency: settings.defaultCurrency,
    steps: [
      { step: 1, title: 'Share your code', description: `Send it to friends who are new to ${settings.platformName}.` },
      { step: 2, title: 'They take a ride', description: 'Your friend signs up and completes a trip.' },
      { step: 3, title: 'You earn credit', description: 'Ride credit is added for both of you.' },
    ],
    stats: { invited: referred.length, rewarded: rewarded.length, totalEarned: rewarded.length * amount },
    referrals: referred.map((r) => ({ name: r.name || 'New user', joinedAt: r.createdAt, status: r.referralRewardedAt ? 'rewarded' : 'pending' })),
    appliedCode: Boolean(customer.referredBy),
  })
}

// POST /referral/apply { code }: a new customer enters a friend's code before their first ride.
export async function applyReferral(req: Request, res: Response) {
  const customer = customerDoc(req)
  const settings = await getPlatformSettings()
  if (!settings.referralEnabled) throw new HttpError(422, 'Referrals are not available right now')
  const code = requireString((req.body ?? {}).code, 'code', 20).toUpperCase()
  if (customer.referredBy) throw new HttpError(409, 'You have already used a referral code')
  if (customer.totalBookings > 0) throw new HttpError(422, 'Referral codes can only be applied before your first ride')
  const owner = await Customer.findOne({ referralCode: code }).select('_id')
  if (!owner) throw new HttpError(404, 'This referral code is not valid')
  if (owner.id === customer.id) throw new HttpError(400, 'You cannot use your own referral code')
  const claimed = await Customer.updateOne({ _id: customer._id, referredBy: null }, { $set: { referredBy: owner._id } })
  if (!claimed.modifiedCount) throw new HttpError(409, 'You have already used a referral code')
  res.json({ message: `Code applied. You will get ₹${settings.referralRewardReferee} ride credit after your first ride.`, rewardForYou: settings.referralRewardReferee })
}
