// Booking money flow and serialization shared by the customer and rider apps.
import crypto from 'crypto'
import type { HydratedDocument, Types } from 'mongoose'
import { Booking, type BookingDocument } from '../models/Booking'
import { Customer } from '../models/Customer'
import { Driver } from '../models/Driver'
import { Payment } from '../models/Payment'
import { Rating } from '../models/Rating'
import { Vehicle } from '../models/Vehicle'
import { computeCommission, computeFare, findPricingRule, type FareBreakdown } from '../utils/fare'
import { routeDistanceKm, travelMinutes, type LatLng } from '../utils/geo'
import { HttpError, roundMoney } from '../utils/http'
import { creditWallet, debitWallet } from '../utils/wallet'

type BookingDoc = HydratedDocument<BookingDocument>

export function generateBookingCode(): string {
  return `BK-${Date.now().toString(36).toUpperCase()}${crypto.randomInt(10, 99)}`
}

export function generateTripOtp(): string {
  return crypto.randomInt(0, 10_000).toString().padStart(4, '0')
}

/** Pickup → stops (transport) or pickup → drop (ride), as points. */
export function routePoints(booking: Pick<BookingDocument, 'pickup' | 'drop' | 'stops' | 'mode'>): LatLng[] {
  const points: LatLng[] = [{ lat: booking.pickup!.lat!, lng: booking.pickup!.lng! }]
  if (booking.mode === 'transport' && booking.stops.length) {
    for (const s of booking.stops) points.push({ lat: s.lat!, lng: s.lng! })
  } else {
    points.push({ lat: booking.drop!.lat!, lng: booking.drop!.lng! })
  }
  return points
}

/** Re-prices the booking from its current route (after a drop change or at trip end). */
export async function repriceBooking(booking: BookingDoc, opts: { waitingMin?: number } = {}): Promise<FareBreakdown> {
  const rule = await findPricingRule(booking.categoryKey, booking.serviceArea)
  if (!rule) throw new HttpError(409, 'Pricing is not configured for this vehicle category')
  const distanceKm = routeDistanceKm(routePoints(booking))
  const durationMin = travelMinutes(distanceKm)
  const fare = computeFare(rule, {
    distanceKm,
    durationMin,
    extraStops: Math.max(0, booking.stops.length - 1),
    needsLoading: Boolean(booking.goodsDetails?.needsLoading),
    waitingMin: opts.waitingMin,
    discount: booking.fare?.discount ?? 0,
    at: booking.startedAt ?? booking.createdAt,
  })
  fare.tip = booking.fare?.tip ?? 0
  booking.set({ fare, distanceKm, durationMin })
  return fare
}

// ---------- Serialization ----------

interface SerializeOptions {
  /** The rider must never see the customer's start/stop OTPs. */
  viewer: 'customer' | 'rider'
}

/** Booking as returned to the apps (populated rider/customer/vehicle when loaded). */
export function serializeBooking(booking: BookingDoc, { viewer }: SerializeOptions) {
  const json = booking.toJSON() as unknown as Record<string, unknown> & {
    stops?: Record<string, unknown>[]
    driver?: unknown
    customer?: unknown
  }
  delete json.offer
  delete json.rejectedBy
  delete json.dispatchAttempts
  delete json.shareToken
  if (viewer === 'rider') {
    delete json.startOtp
    json.stops = (json.stops ?? []).map(({ otp: _otp, ...stop }) => stop)
    json.customer = maskPerson(json.customer)
  } else {
    delete json.settlement
    json.driver = maskPerson(json.driver)
  }
  return json
}

// Phone numbers are never shared between customer and rider; calls go through /call.
function maskPerson(person: unknown) {
  if (!person || typeof person !== 'object') return person
  const { phone: _phone, email: _email, ...rest } = person as Record<string, unknown>
  return rest
}

export const RIDER_PUBLIC_FIELDS = 'name rating photoUrl currentLocation'
export const CUSTOMER_PUBLIC_FIELDS = 'name rating photoUrl'
export const VEHICLE_PUBLIC_FIELDS = 'registrationNumber model manufacturer categoryKey'

/** The vehicle a rider drives: the admin-assigned one, else their latest active vehicle. */
export async function activeVehicleFor(driverId: Types.ObjectId | string, assignedVehicle?: Types.ObjectId | null) {
  if (assignedVehicle) {
    const assigned = await Vehicle.findOne({ _id: assignedVehicle, status: 'active' })
    if (assigned) return assigned
  }
  return Vehicle.findOne({ ownerType: 'driver', ownerId: driverId, status: 'active' }).sort({ updatedAt: -1 })
}

// ---------- Completion and payment ----------

/** Ends the trip: final fare (with waiting time), commission, rider stats. Payment is settled separately. */
export async function completeTrip(bookingId: string, driverId: Types.ObjectId, freeWaitingMinutes: number) {
  const now = new Date()
  // Atomic transition so a repeated "complete" can never settle the trip twice.
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, driver: driverId, status: { $in: ['started', 'in_transit'] } },
    { $set: { status: 'completed', completedAt: now } },
    { new: true },
  )
  if (!booking) throw new HttpError(409, 'This trip is not in progress')

  const waited = booking.arrivedAt && booking.startedAt ? (booking.startedAt.getTime() - booking.arrivedAt.getTime()) / 60_000 : 0
  const waitingMin = Math.max(0, Math.ceil(waited - freeWaitingMinutes))
  const fare = await repriceBooking(booking, { waitingMin })
  const commission = await computeCommission(booking.categoryKey, fare.total)
  booking.set({ settlement: { commission, riderEarning: roundMoney(fare.total - commission) } })
  booking.timeline.push({ status: 'completed', at: now, note: 'Trip completed' })
  await booking.save()

  await Promise.all([
    Driver.updateOne({ _id: booking.driver }, { $inc: { totalTrips: 1 }, $set: { onlineStatus: 'online' } }),
    Customer.updateOne({ _id: booking.customer }, { $inc: { totalBookings: 1 } }),
  ])

  // Wallet bookings are charged straight away; cash waits for the rider, online for the gateway.
  if (fare.total <= 0) {
    await settleBookingPayment(booking.id, { method: 'wallet' })
  } else if (booking.paymentMethod === 'wallet') {
    try {
      await debitWallet({ ownerType: 'customer', ownerId: booking.customer, amount: fare.total, reason: 'booking_payment', referenceType: 'Booking', referenceId: booking._id })
      await settleBookingPayment(booking.id, { method: 'wallet' })
    } catch (err) {
      // Not enough balance: the booking stays unpaid and the customer pays online from the app.
      if (!(err instanceof HttpError && err.status === 402)) throw err
    }
  }
  return Booking.findById(booking.id)
}

/**
 * Marks a completed booking paid (once) and moves the rider's share:
 * cash → the rider already holds the money, so the commission becomes dues;
 * wallet/online → the platform collected it, so the rider's earning is credited.
 */
export async function settleBookingPayment(
  bookingId: string,
  opts: { method: 'cash' | 'wallet' | 'online'; gateway?: 'razorpay' | 'internal'; gatewayRefId?: string },
) {
  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'completed', paymentStatus: 'pending' },
    { $set: { paymentStatus: 'paid' }, $push: { timeline: { status: 'paid', at: new Date(), note: `Paid by ${opts.method}` } } },
    { new: true },
  )
  if (!booking) return null

  const total = booking.fare?.total ?? 0
  await Payment.create({
    booking: booking._id,
    amount: total,
    // An online payment for a cash/wallet booking is recorded as UPI.
    method: opts.method !== 'online' ? opts.method : ['upi', 'card', 'netbanking'].includes(booking.paymentMethod) ? booking.paymentMethod : 'upi',
    gateway: opts.method === 'cash' ? 'cash' : opts.method === 'online' ? opts.gateway ?? 'internal' : 'internal',
    gatewayRefId: opts.gatewayRefId,
    status: 'success',
  })

  const { commission = 0, riderEarning = 0 } = booking.settlement ?? {}
  const ref = { referenceType: 'Booking', referenceId: booking._id }
  if (opts.method === 'cash') {
    await debitWallet({ ownerType: 'driver', ownerId: booking.driver!, amount: commission, reason: 'commission', allowNegative: true, ...ref })
  } else {
    await creditWallet({ ownerType: 'driver', ownerId: booking.driver!, amount: riderEarning, reason: 'booking_earning', ...ref })
  }
  await Driver.updateOne({ _id: booking.driver }, { $inc: { earnings: riderEarning } })
  return booking
}

// ---------- Cancellation ----------

/** Customer cancellation charge: free while searching or within the free window after a rider accepts. */
export async function customerCancellationCharge(booking: BookingDoc, freeCancellationMinutes: number): Promise<number> {
  if (!booking.driver || !booking.acceptedAt) return 0
  const minutesSinceAccept = (Date.now() - booking.acceptedAt.getTime()) / 60_000
  if (booking.status !== 'arrived' && minutesSinceAccept <= freeCancellationMinutes) return 0
  const rule = await findPricingRule(booking.categoryKey, booking.serviceArea)
  return rule?.cancellationFee ?? 0
}

/** Charges the customer (wallet may go negative) and compensates the rider. */
export async function applyCancellationCharge(booking: BookingDoc, charge: number) {
  if (charge <= 0 || !booking.driver) return
  const ref = { referenceType: 'Booking', referenceId: booking._id }
  await debitWallet({ ownerType: 'customer', ownerId: booking.customer, amount: charge, reason: 'penalty', allowNegative: true, ...ref })
  await creditWallet({ ownerType: 'driver', ownerId: booking.driver, amount: charge, reason: 'booking_earning', ...ref })
}

// ---------- Ratings ----------

export async function refreshAverageRating(target: 'driver' | 'customer', id: Types.ObjectId) {
  const match = target === 'driver' ? { driver: id, ratedBy: 'customer' } : { customer: id, ratedBy: 'driver' }
  const [result] = await Rating.aggregate<{ avg: number }>([{ $match: match }, { $group: { _id: null, avg: { $avg: '$score' } } }])
  const rating = result ? Math.round(result.avg * 10) / 10 : 0
  if (target === 'driver') await Driver.updateOne({ _id: id }, { rating })
  else await Customer.updateOne({ _id: id }, { rating })
}

export function parseScore(value: unknown): number {
  const score = typeof value === 'string' ? Number(value) : value
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5) throw new HttpError(400, 'score must be a whole number from 1 to 5')
  return score
}
