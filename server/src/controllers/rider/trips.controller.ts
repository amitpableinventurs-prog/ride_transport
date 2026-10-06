// Rider app: incoming requests and the trip lifecycle.
import type { Request, Response } from 'express'
import { Types, type FilterQuery, type HydratedDocument } from 'mongoose'
import { ACTIVE_TRIP_STATUSES, Booking, BOOKING_STATUSES, type BookingDocument, type BookingStatus } from '../../models/Booking'
import { Driver, type DriverDocument } from '../../models/Driver'
import { Rating } from '../../models/Rating'
import { emitBookingEvent, joinBookingRoom, leaveBookingRoom } from '../../realtime/socket'
import { rejectOffer, requestPayload, startDispatch, stopDispatch } from '../../services/dispatch'
import {
  activeVehicleFor,
  completeTrip,
  CUSTOMER_PUBLIC_FIELDS,
  parseScore,
  refreshAverageRating,
  serializeBooking,
  settleBookingPayment,
  VEHICLE_PUBLIC_FIELDS,
} from '../../services/trips'
import { etaMinutes } from '../../utils/geo'
import { HttpError, optionalString, parseDate, parsePagination, requireObjectId, requireString, roundMoney } from '../../utils/http'
import { notifyUser } from '../../utils/notify'
import { getPlatformSettings } from '../../utils/settings'
import { uploadedFileUrl } from '../../utils/uploads'

type DriverDoc = HydratedDocument<DriverDocument>
type BookingDoc = HydratedDocument<BookingDocument>

const RIDER_CANCELLABLE: BookingStatus[] = ['accepted', 'arriving', 'arrived']
const EARNINGS_DEFAULT_DAYS = 7

function driverDoc(req: Request): DriverDoc {
  return req.appUser!.doc as DriverDoc
}

async function findOwnBooking(req: Request) {
  const booking = await Booking.findOne({ _id: requireObjectId(req.params.id, 'id'), driver: driverDoc(req)._id })
  if (!booking) throw new HttpError(404, 'Booking not found')
  return booking
}

async function riderView(bookingId: string) {
  const booking = (await Booking.findById(bookingId).populate('customer', CUSTOMER_PUBLIC_FIELDS).populate('vehicle', VEHICLE_PUBLIC_FIELDS)) as BookingDoc
  return serializeBooking(booking, { viewer: 'rider' })
}

function statusEvent(booking: BookingDoc, extra: Record<string, unknown> = {}) {
  emitBookingEvent(booking.id, 'booking:status', { bookingId: booking.id, status: booking.status, timestamp: new Date().toISOString(), ...extra }, ['customer', 'admin'])
}

/** Atomically moves the rider's booking between statuses; 409 when it is not in an expected state. */
async function transition(req: Request, from: BookingStatus[], set: Record<string, unknown>, note: string) {
  const status = set.status as string
  const booking = await Booking.findOneAndUpdate(
    { _id: requireObjectId(req.params.id, 'id'), driver: driverDoc(req)._id, status: { $in: from } },
    { $set: set, $push: { timeline: { status, at: new Date(), note } } },
    { new: true },
  )
  if (!booking) {
    const exists = await Booking.exists({ _id: req.params.id, driver: driverDoc(req)._id })
    throw new HttpError(exists ? 409 : 404, exists ? 'This action is not allowed at the current trip stage' : 'Booking not found')
  }
  return booking
}

// ---------- Requests ----------

// GET /requests/current
export async function currentRequest(req: Request, res: Response) {
  const booking = await Booking.findOne({ status: 'requested', 'offer.driver': driverDoc(req)._id, 'offer.expiresAt': { $gt: new Date() } })
  res.json({ request: booking ? await requestPayload(booking) : null })
}

// POST /requests/:bookingId/accept
export async function acceptRequest(req: Request, res: Response) {
  const driver = driverDoc(req)
  const bookingId = requireObjectId(req.params.bookingId, 'bookingId')

  // Claim the rider first so they can never hold two trips.
  const claimed = await Driver.findOneAndUpdate({ _id: driver._id, onlineStatus: 'online' }, { onlineStatus: 'on_trip' })
  if (!claimed) throw new HttpError(409, 'Go online to accept requests')

  const vehicle = await activeVehicleFor(driver._id, driver.assignedVehicle)
  const now = new Date()
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'requested', 'offer.driver': driver._id, 'offer.expiresAt': { $gt: now } },
    {
      $set: { status: 'accepted', driver: driver._id, vehicle: vehicle?._id ?? null, partner: driver.onboarding?.partner ?? null, acceptedAt: now, offer: { driver: null } },
      $push: { timeline: { status: 'accepted', at: now, note: `Accepted by ${driver.name || driver.phone}` } },
    },
    { new: true },
  )
  if (!booking) {
    await Driver.updateOne({ _id: driver._id, onlineStatus: 'on_trip' }, { onlineStatus: 'online' })
    throw new HttpError(409, 'This request is no longer available')
  }

  stopDispatch(booking.id)
  joinBookingRoom(booking.id, { customerId: booking.customer, driverId: driver._id })
  const loc = driver.currentLocation
  const etaMin = loc?.lat != null && loc.lng != null ? etaMinutes({ lat: loc.lat, lng: loc.lng }, { lat: booking.pickup!.lat!, lng: booking.pickup!.lng! }) : null
  emitBookingEvent(
    booking.id,
    'booking:rider_assigned',
    {
      bookingId: booking.id,
      rider: { id: driver.id, name: driver.name, rating: driver.rating, photoUrl: driver.photoUrl },
      vehicle: vehicle ? { registrationNumber: vehicle.registrationNumber, model: vehicle.model, manufacturer: vehicle.manufacturer } : null,
      etaMin,
    },
    ['customer'],
  )
  statusEvent(booking)
  await notifyUser('customer', booking.customer, {
    title: 'Rider assigned',
    body: `${driver.name || 'Your rider'} is on the way${vehicle ? ` in ${vehicle.registrationNumber}` : ''}`,
    data: { bookingId: booking.id, type: 'rider_assigned' },
  })
  res.json(await riderView(booking.id))
}

// POST /requests/:bookingId/reject
export async function rejectRequest(req: Request, res: Response) {
  const bookingId = requireObjectId(req.params.bookingId, 'bookingId').toString()
  const released = await rejectOffer(bookingId, driverDoc(req).id)
  if (!released) throw new HttpError(409, 'This request is no longer available')
  res.status(204).send()
}

// ---------- Trip ----------

// GET /bookings/active
export async function activeBooking(req: Request, res: Response) {
  const booking = await Booking.findOne({ driver: driverDoc(req)._id, status: { $in: ACTIVE_TRIP_STATUSES } }).select('_id')
  res.json({ booking: booking ? await riderView(booking.id) : null })
}

// POST /bookings/:id/arrived
export async function markArrived(req: Request, res: Response) {
  const booking = await transition(req, ['accepted', 'arriving'], { status: 'arrived', arrivedAt: new Date() }, 'Rider arrived at pickup')
  statusEvent(booking)
  await notifyUser('customer', booking.customer, { title: 'Your rider has arrived', body: `Share OTP ${booking.startOtp} to start the trip`, data: { bookingId: booking.id, type: 'rider_arrived' } })
  res.json(await riderView(booking.id))
}

// POST /bookings/:id/start (multipart for transport: otp + goodsPhoto)
export async function startTrip(req: Request, res: Response) {
  const current = await findOwnBooking(req)
  if (current.status !== 'arrived') throw new HttpError(409, 'Mark yourself arrived at the pickup first')
  if (requireString((req.body ?? {}).otp, 'otp', 10) !== current.startOtp) throw new HttpError(400, 'Incorrect OTP')
  if (current.mode === 'transport' && !req.file) throw new HttpError(400, 'goodsPhoto is required for transport pickups')

  const set: Record<string, unknown> = { status: current.mode === 'transport' ? 'in_transit' : 'started', startedAt: new Date() }
  if (req.file) set.goodsPhotoUrl = uploadedFileUrl('goods', req.file)
  const booking = await transition(req, ['arrived'], set, current.mode === 'transport' ? 'Goods picked up' : 'Trip started')
  statusEvent(booking)
  res.json(await riderView(booking.id))
}

// POST /bookings/:id/stops/:stopId/complete (multipart: otp + pod)
export async function completeStop(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  if (booking.mode !== 'transport' || booking.status !== 'in_transit') throw new HttpError(409, 'Drops can be completed only during a transport trip')
  const stop = booking.stops.id(requireObjectId(req.params.stopId, 'stopId'))
  if (!stop) throw new HttpError(404, 'Drop not found')
  if (stop.status === 'completed') throw new HttpError(409, 'This drop is already completed')
  if (requireString((req.body ?? {}).otp, 'otp', 10) !== stop.otp) throw new HttpError(400, 'Incorrect OTP')
  if (!req.file) throw new HttpError(400, 'pod (proof of delivery photo) is required')

  // Positional update so concurrent requests cannot complete the same drop twice.
  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'in_transit', stops: { $elemMatch: { _id: stop._id, status: 'pending' } } },
    {
      $set: { 'stops.$.status': 'completed', 'stops.$.completedAt': new Date(), 'stops.$.podUrl': uploadedFileUrl('pod', req.file) },
      $push: { timeline: { status: 'in_transit', at: new Date(), note: `Delivered at ${stop.address ?? 'drop'}` } },
    },
    { new: true },
  )
  if (!updated) throw new HttpError(409, 'This drop is already completed')
  statusEvent(updated, { stopId: stop.id, stopStatus: 'completed' })
  res.json(await riderView(updated.id))
}

// POST /bookings/:id/complete: ends the trip and returns the final fare.
export async function completeBooking(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  if (booking.mode === 'transport' && booking.stops.some((s) => s.status !== 'completed')) throw new HttpError(409, 'Complete every drop before ending the trip')

  const settings = await getPlatformSettings()
  const completed = (await completeTrip(booking.id, driverDoc(req)._id, settings.freeWaitingMinutes))!
  leaveBookingRoom(completed.id, { driverId: completed.driver })
  statusEvent(completed, { fare: completed.fare })
  await notifyUser('customer', completed.customer, {
    title: 'Trip completed',
    body: `Total fare ₹${completed.fare?.total}. ${completed.paymentStatus === 'paid' ? 'Paid.' : completed.paymentMethod === 'cash' ? 'Please pay the rider in cash.' : 'Please complete the payment in the app.'}`,
    data: { bookingId: completed.id, type: 'trip_completed' },
  })

  res.json({
    booking: await riderView(completed.id),
    fare: completed.fare,
    earning: completed.settlement?.riderEarning,
    collectCash: completed.paymentStatus === 'pending' && completed.paymentMethod === 'cash' ? completed.fare?.total : 0,
  })
}

// POST /bookings/:id/cash-collected
export async function confirmCashCollected(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  if (booking.status !== 'completed') throw new HttpError(409, 'Complete the trip first')
  if (booking.paymentStatus !== 'pending') throw new HttpError(409, 'This booking is already paid')
  await settleBookingPayment(booking.id, { method: 'cash' })
  const updated = (await Booking.findById(booking.id))!
  emitBookingEvent(booking.id, 'booking:status', { bookingId: booking.id, status: updated.status, paymentStatus: updated.paymentStatus, timestamp: new Date().toISOString() }, ['customer', 'admin'])
  res.json(await riderView(booking.id))
}

// POST /bookings/:id/cancel: the booking goes back to searching for another rider.
export async function cancelByRider(req: Request, res: Response) {
  const driver = driverDoc(req)
  const reason = requireString((req.body ?? {}).reason, 'reason', 300)
  const booking = await Booking.findOneAndUpdate(
    { _id: requireObjectId(req.params.id, 'id'), driver: driver._id, status: { $in: RIDER_CANCELLABLE } },
    {
      $set: { status: 'requested', driver: null, vehicle: null, partner: null, acceptedAt: null, arrivedAt: null, offer: { driver: null } },
      $addToSet: { rejectedBy: driver._id },
      $push: { timeline: { status: 'requested', at: new Date(), note: `Rider cancelled: ${reason}` } },
    },
    { new: true },
  )
  if (!booking) throw new HttpError(409, 'This trip can no longer be cancelled')

  await Driver.updateOne({ _id: driver._id }, { $inc: { cancellations: 1 }, $set: { onlineStatus: 'online' } })
  leaveBookingRoom(booking.id, { driverId: driver._id })
  emitBookingEvent(
    booking.id,
    'booking:status',
    { bookingId: booking.id, status: 'requested', timestamp: new Date().toISOString(), note: 'Your rider cancelled. Finding you another rider.' },
    ['customer', 'admin'],
  )
  await notifyUser('customer', booking.customer, { title: 'Finding another rider', body: 'Your rider had to cancel. We are finding you another one.', data: { bookingId: booking.id, type: 'rider_cancelled' } })
  startDispatch(booking.id)
  res.status(204).send()
}

// POST /bookings/:id/rating: rate the customer.
export async function rateCustomer(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  if (booking.status !== 'completed') throw new HttpError(409, 'You can rate the customer once the trip is completed')
  const score = parseScore((req.body ?? {}).score)
  const claimed = await Booking.findOneAndUpdate({ _id: booking._id, ratedByRider: false }, { $set: { ratedByRider: true } })
  if (!claimed) throw new HttpError(409, 'You have already rated this trip')

  const rating = await Rating.create({ booking: booking._id, customer: booking.customer, driver: booking.driver, ratedBy: 'driver', score, comment: optionalString((req.body ?? {}).comment, 500) })
  await refreshAverageRating('customer', booking.customer)
  res.status(201).json(rating)
}

// ---------- History and earnings ----------

// GET /bookings?status=&from=&to=
export async function listTrips(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const filter: FilterQuery<BookingDocument> = { driver: driverDoc(req)._id }
  if (typeof req.query.status === 'string' && req.query.status) {
    const statuses = req.query.status.split(',').map((s) => s.trim())
    if (statuses.some((s) => !BOOKING_STATUSES.includes(s as BookingStatus))) throw new HttpError(400, `status must be one of: ${BOOKING_STATUSES.join(', ')}`)
    filter.status = { $in: statuses as BookingStatus[] }
  }
  const from = parseDate(req.query.from, 'from')
  const to = parseDate(req.query.to, 'to', true)
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) }

  const [items, total] = await Promise.all([
    Booking.find(filter).populate('customer', CUSTOMER_PUBLIC_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Booking.countDocuments(filter),
  ])
  res.json({ items: items.map((b) => serializeBooking(b, { viewer: 'rider' })), total, page, limit })
}

// GET /earnings?from=&to= (defaults to the last 7 days)
export async function getEarnings(req: Request, res: Response) {
  const to = parseDate(req.query.to, 'to', true) ?? new Date()
  const from = parseDate(req.query.from, 'from') ?? new Date(to.getTime() - EARNINGS_DEFAULT_DAYS * 86_400_000)
  if (from > to) throw new HttpError(400, 'from must be before to')

  const trips = await Booking.find({ driver: new Types.ObjectId(driverDoc(req).id), status: 'completed', completedAt: { $gte: from, $lte: to } })
    .select('bookingCode mode categoryKey completedAt fare settlement paymentMethod paymentStatus distanceKm')
    .sort({ completedAt: -1 })

  const perTrip = trips.map((t) => ({
    bookingId: t.id,
    bookingCode: t.bookingCode,
    mode: t.mode,
    categoryKey: t.categoryKey,
    completedAt: t.completedAt,
    distanceKm: t.distanceKm,
    fare: t.fare?.total ?? 0,
    commission: t.settlement?.commission ?? 0,
    earning: t.settlement?.riderEarning ?? 0,
    tip: t.fare?.tip ?? 0,
    paymentMethod: t.paymentMethod,
    paymentStatus: t.paymentStatus,
  }))
  const sum = (pick: (t: (typeof perTrip)[number]) => number, list = perTrip) => roundMoney(list.reduce((acc, t) => acc + pick(t), 0))

  res.json({
    from,
    to,
    summary: {
      trips: perTrip.length,
      grossFare: sum((t) => t.fare),
      commission: sum((t) => t.commission),
      netEarnings: sum((t) => t.earning),
      tips: sum((t) => t.tip),
      cashCollected: sum((t) => t.fare, perTrip.filter((t) => t.paymentMethod === 'cash' && t.paymentStatus === 'paid')),
    },
    perTrip,
  })
}
