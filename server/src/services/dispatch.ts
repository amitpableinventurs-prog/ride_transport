// Matching: a requested booking is offered to one nearby eligible rider at a
// time. The rider has `riderRequestTimeoutSeconds` to accept; on reject or
// timeout the next-nearest rider gets it, up to `maxDispatchAttempts` riders.
import { Types, type HydratedDocument } from 'mongoose'
import { Booking, type BookingDocument } from '../models/Booking'
import { Driver } from '../models/Driver'
import { Vehicle } from '../models/Vehicle'
import { computeCommission } from '../utils/fare'
import { haversineKm, type LatLng } from '../utils/geo'
import { notifyUser } from '../utils/notify'
import { getPlatformSettings } from '../utils/settings'
import { emitBookingEvent, emitToRider } from '../realtime/socket'
import { boundingBox } from '../utils/geo'

type BookingDoc = HydratedDocument<BookingDocument>

/** Riders whose last location is older than this are not offered bookings. */
const LOCATION_FRESH_MS = 5 * 60 * 1000
const SWEEP_INTERVAL_MS = 15 * 1000

const timers = new Map<string, NodeJS.Timeout>()

function clearTimer(bookingId: string) {
  const timer = timers.get(bookingId)
  if (timer) clearTimeout(timer)
  timers.delete(bookingId)
}

function scheduleExpiry(bookingId: string, driverId: string, expiresAt: Date) {
  clearTimer(bookingId)
  const timer = setTimeout(() => void expireOffer(bookingId, driverId).catch(logError), Math.max(0, expiresAt.getTime() - Date.now()) + 250)
  timer.unref()
  timers.set(bookingId, timer)
}

function logError(err: unknown) {
  console.error('[dispatch]', err)
}

/** Riders who own an active vehicle in the category. */
async function vehicleOwnersFor(categoryKey: string) {
  return Vehicle.find({ categoryKey, status: 'active', ownerType: 'driver' }).distinct('ownerId')
}

/** Online, approved riders near a point who can serve the category, nearest first. */
export async function findNearbyRiders(point: LatLng, categoryKey: string, opts: { radiusKm: number; exclude?: Types.ObjectId[]; limit?: number }) {
  const [vehicleOwners, busyWithOffer] = await Promise.all([
    vehicleOwnersFor(categoryKey),
    Booking.find({ status: 'requested', 'offer.driver': { $ne: null }, 'offer.expiresAt': { $gt: new Date() } }).distinct('offer.driver'),
  ])
  const exclude = [...(opts.exclude ?? []), ...busyWithOffer]

  const box = boundingBox(point, opts.radiusKm)
  const riders = await Driver.find({
    _id: { $nin: exclude },
    'currentLocation.lat': { $gte: box.minLat, $lte: box.maxLat },
    'currentLocation.lng': { $gte: box.minLng, $lte: box.maxLng },
    status: 'active',
    approvalStatus: 'verified',
    onlineStatus: 'online',
    'currentLocation.updatedAt': { $gte: new Date(Date.now() - LOCATION_FRESH_MS) },
    // Riders pick services during onboarding; seeded/admin-created riders qualify through their vehicle.
    $or: [{ 'onboarding.services': categoryKey }, { _id: { $in: vehicleOwners } }],
  }).select('name rating currentLocation assignedVehicle')

  return riders
    .map((rider) => ({ rider, distanceKm: haversineKm(point, { lat: rider.currentLocation!.lat!, lng: rider.currentLocation!.lng! }) }))
    .filter((r) => r.distanceKm <= opts.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, opts.limit ?? 20)
}

/** Booking payload shown on the rider's incoming-request screen. */
export async function requestPayload(booking: BookingDoc, distanceToPickupKm?: number) {
  const commission = await computeCommission(booking.categoryKey, booking.fare?.total ?? 0)
  return {
    bookingId: booking.id,
    bookingCode: booking.bookingCode,
    mode: booking.mode,
    categoryKey: booking.categoryKey,
    pickup: booking.pickup,
    drop: booking.drop,
    stops: booking.stops.map((s) => ({ id: s.id, address: s.address, lat: s.lat, lng: s.lng })),
    distanceKm: booking.distanceKm,
    distanceToPickupKm: distanceToPickupKm != null ? Math.round(distanceToPickupKm * 10) / 10 : undefined,
    paymentMethod: booking.paymentMethod,
    earning: Math.round(((booking.fare?.total ?? 0) - commission) * 100) / 100,
    expiresAt: booking.offer?.expiresAt,
  }
}

async function markNoRiderFound(bookingId: string) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'requested' },
    { $set: { status: 'no_rider_found', offer: { driver: null } }, $push: { timeline: { status: 'no_rider_found', at: new Date(), note: 'No rider accepted' } } },
    { new: true },
  )
  if (!booking) return
  clearTimer(bookingId)
  const event = { bookingId, status: 'no_rider_found', timestamp: new Date().toISOString() }
  emitBookingEvent(bookingId, 'booking:status', event, ['customer', 'admin'])
  await notifyUser('customer', booking.customer, {
    title: 'No rider found',
    body: `We couldn't find a rider for ${booking.bookingCode}. Tap to try again.`,
    data: { bookingId, type: 'no_rider_found' },
  })
}

/** Offers the booking to the next eligible rider, or marks it "no rider found". */
export async function offerNext(bookingId: string): Promise<void> {
  const booking = await Booking.findById(bookingId)
  if (!booking || booking.status !== 'requested') return
  if (booking.offer?.driver && booking.offer.expiresAt && booking.offer.expiresAt > new Date()) return

  const settings = await getPlatformSettings()
  if (booking.dispatchAttempts >= settings.maxDispatchAttempts) return markNoRiderFound(bookingId)

  const [candidate] = await findNearbyRiders(
    { lat: booking.pickup!.lat!, lng: booking.pickup!.lng! },
    booking.categoryKey,
    { radiusKm: settings.dispatchRadiusKm, exclude: booking.rejectedBy, limit: 1 },
  )
  if (!candidate) return markNoRiderFound(bookingId)

  const now = new Date()
  const expiresAt = new Date(now.getTime() + settings.riderRequestTimeoutSeconds * 1000)
  // Only one offer may be live per booking; a concurrent call loses this update.
  const offered = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      status: 'requested',
      $or: [{ 'offer.driver': null }, { 'offer.driver': { $exists: false } }, { 'offer.expiresAt': { $lte: now } }],
    },
    { $set: { offer: { driver: candidate.rider._id, offeredAt: now, expiresAt } }, $inc: { dispatchAttempts: 1 } },
    { new: true },
  )
  if (!offered) return

  scheduleExpiry(bookingId, candidate.rider.id, expiresAt)
  emitToRider(candidate.rider._id, 'booking:request', await requestPayload(offered, candidate.distanceKm))
  await notifyUser('driver', candidate.rider._id, {
    title: 'New booking request',
    body: `${offered.mode === 'ride' ? 'Ride' : 'Delivery'} pickup ${candidate.distanceKm.toFixed(1)} km away`,
    data: { bookingId, type: 'booking_request' },
    // A late push for an expired offer is useless.
    ttlSeconds: settings.riderRequestTimeoutSeconds,
  })
}

/** Clears the rider's offer (rejected or timed out) and moves on. Returns false if the offer was no longer theirs. */
async function releaseOffer(bookingId: string, driverId: string, note: string): Promise<boolean> {
  const released = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'requested', 'offer.driver': driverId },
    { $set: { offer: { driver: null } }, $addToSet: { rejectedBy: new Types.ObjectId(driverId) }, $push: { timeline: { status: 'requested', at: new Date(), note } } },
  )
  if (!released) return false
  clearTimer(bookingId)
  emitToRider(driverId, 'booking:request_expired', { bookingId })
  await offerNext(bookingId)
  return true
}

export const expireOffer = (bookingId: string, driverId: string) => releaseOffer(bookingId, driverId, 'Rider did not respond')
export const rejectOffer = (bookingId: string, driverId: string) => releaseOffer(bookingId, driverId, 'Rider rejected the request')

/** Starts (or restarts) matching for a booking that is in `requested`. */
export function startDispatch(bookingId: string) {
  void offerNext(bookingId).catch(logError)
}

export function stopDispatch(bookingId: string) {
  clearTimer(bookingId)
}

/**
 * Safety net run on an interval: starts scheduled bookings that are due,
 * re-offers bookings whose offer expired (e.g. after a server restart) and
 * re-arms timers for live offers this process doesn't know about.
 */
async function sweep() {
  const settings = await getPlatformSettings()
  const now = new Date()

  const due = await Booking.find({ status: 'scheduled', scheduledAt: { $lte: new Date(now.getTime() + settings.scheduleLeadMinutes * 60_000) } }).select('_id')
  for (const b of due) {
    const started = await Booking.findOneAndUpdate(
      { _id: b._id, status: 'scheduled' },
      { $set: { status: 'requested' }, $push: { timeline: { status: 'requested', at: now, note: 'Scheduled booking: searching for a rider' } } },
    )
    if (started) {
      emitBookingEvent(b.id, 'booking:status', { bookingId: b.id, status: 'requested', timestamp: now.toISOString() }, ['customer', 'admin'])
      await offerNext(b.id)
    }
  }

  const searching = await Booking.find({ status: 'requested' }).select('_id offer')
  for (const b of searching) {
    const driverId = b.offer?.driver?.toString()
    if (!driverId) await offerNext(b.id)
    else if (b.offer!.expiresAt! <= now) await expireOffer(b.id, driverId)
    else if (!timers.has(b.id)) scheduleExpiry(b.id, driverId, b.offer!.expiresAt!)
  }
}

export function startDispatchSweeper() {
  const run = () => void sweep().catch(logError)
  run()
  setInterval(run, SWEEP_INTERVAL_MS).unref()
}
