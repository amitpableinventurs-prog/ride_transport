// Customer app: fare estimates and the booking lifecycle.
import crypto from 'crypto'
import type { Request, Response } from 'express'
import type { FilterQuery, HydratedDocument } from 'mongoose'
import { env } from '../../config/env'
import { ACTIVE_TRIP_STATUSES, Booking, BOOKING_STATUSES, type BookingDocument, type BookingStatus } from '../../models/Booking'
import { Coupon } from '../../models/Coupon'
import type { CustomerDocument } from '../../models/Customer'
import { Driver } from '../../models/Driver'
import { Rating } from '../../models/Rating'
import { ServiceCategory, type ServiceCategoryDocument } from '../../models/ServiceCategory'
import { emitBookingEvent, emitToRider, joinBookingRoom, leaveBookingRoom } from '../../realtime/socket'
import { startDispatch, stopDispatch } from '../../services/dispatch'
import {
  applyCancellationCharge,
  customerCancellationCharge,
  generateBookingCode,
  generateTripOtp,
  parseScore,
  refreshAverageRating,
  repriceBooking,
  RIDER_PUBLIC_FIELDS,
  serializeBooking,
  VEHICLE_PUBLIC_FIELDS,
} from '../../services/trips'
import { isProfileComplete } from '../../utils/appUsers'
import { applyCoupon } from '../../utils/coupons'
import { computeFare, findPricingRule } from '../../utils/fare'
import { etaMinutes, findServiceArea, parsePlace, routeDistanceKm, travelMinutes, type Place } from '../../utils/geo'
import { HttpError, optionalString, parseAmount, parseDate, parsePagination, requireObjectId, requireString } from '../../utils/http'
import { signInvoiceToken } from '../../utils/jwt'
import { notifyUser } from '../../utils/notify'
import { normalizeIndianMobile } from '../../utils/phone'
import { getPlatformSettings } from '../../utils/settings'
import { getTelephonyProvider } from '../../utils/telephony'
import { getOrCreateWallet, creditWallet, debitWallet } from '../../utils/wallet'

const MAX_TRANSPORT_STOPS = 5
const MAX_SCHEDULE_DAYS = 7
const MIN_SCHEDULE_AHEAD_MIN = 30
const PAYMENT_METHODS = ['cash', 'wallet', 'upi', 'card', 'netbanking'] as const
const CUSTOMER_CANCELLABLE: BookingStatus[] = ['scheduled', 'requested', 'no_rider_found', 'accepted', 'arriving', 'arrived']
const DROP_CHANGEABLE: BookingStatus[] = ['accepted', 'arriving', 'arrived', 'started', 'in_transit']
const MAX_TIP = 500

type BookingDoc = HydratedDocument<BookingDocument>

function customerDoc(req: Request): HydratedDocument<CustomerDocument> {
  return req.appUser!.doc as HydratedDocument<CustomerDocument>
}

async function findOwnBooking(req: Request) {
  const booking = await Booking.findOne({ _id: requireObjectId(req.params.id, 'id'), customer: customerDoc(req)._id })
  if (!booking) throw new HttpError(404, 'Booking not found')
  return booking
}

async function populated(bookingId: string) {
  return (await Booking.findById(bookingId).populate('driver', RIDER_PUBLIC_FIELDS).populate('vehicle', VEHICLE_PUBLIC_FIELDS)) as BookingDoc
}

// ---------- Trip input shared by estimate and create ----------

interface TransportStopInput extends Place {
  contactName?: string
  contactPhone?: string
}

interface TripInput {
  pickup: Place
  drops: TransportStopInput[]
  goods?: { description?: string; weightKg?: number; notes?: string; needsLoading?: boolean }
}

function parseTripInput(body: Record<string, unknown>): TripInput {
  const pickup = parsePlace(body.pickup, 'pickup')
  const rawDrops = Array.isArray(body.drops) ? body.drops : body.drop ? [body.drop] : []
  if (!rawDrops.length) throw new HttpError(400, 'drops (or drop) is required')
  if (rawDrops.length > MAX_TRANSPORT_STOPS) throw new HttpError(400, `A booking can have at most ${MAX_TRANSPORT_STOPS} drops`)

  const drops = rawDrops.map((d: Record<string, unknown>, i) => {
    const place: TransportStopInput = parsePlace(d, `drops[${i}]`)
    const contactName = optionalString(d?.contactName, 80)
    if (contactName) place.contactName = contactName
    if (d?.contactPhone !== undefined && d.contactPhone !== '') {
      const phone = normalizeIndianMobile(d.contactPhone)
      if (!phone) throw new HttpError(400, `drops[${i}].contactPhone must be a valid 10-digit mobile number`)
      place.contactPhone = phone
    }
    return place
  })

  const g = body.goods as Record<string, unknown> | undefined
  const weightKg = g?.weightKg !== undefined ? Number(g.weightKg) : undefined
  if (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 50_000)) throw new HttpError(400, 'goods.weightKg must be a positive number')
  const goods = g
    ? { description: optionalString(g.description, 200), weightKg, notes: optionalString(g.notes, 500), needsLoading: g.needsLoading === true || g.needsLoading === 'true' }
    : undefined

  return { pickup, drops, goods }
}

function routeFor(mode: 'ride' | 'transport', trip: TripInput) {
  const points = mode === 'ride' ? [trip.pickup, trip.drops[0]] : [trip.pickup, ...trip.drops]
  const distanceKm = routeDistanceKm(points)
  return { distanceKm, durationMin: travelMinutes(distanceKm), extraStops: mode === 'transport' ? trip.drops.length - 1 : 0 }
}

async function priceCategory(category: HydratedDocument<ServiceCategoryDocument>, trip: TripInput, serviceAreaId: BookingDocument['serviceArea'], at?: Date) {
  const rule = await findPricingRule(category.key, serviceAreaId)
  if (!rule) return null
  const route = routeFor(category.mode, trip)
  return { ...route, fare: computeFare(rule, { ...route, needsLoading: category.mode === 'transport' && trip.goods?.needsLoading, at }) }
}

async function serviceAreaFor(pickup: Place) {
  const area = await findServiceArea(pickup)
  if (!area) throw new HttpError(422, "We don't operate at this pickup location yet")
  return area
}

// POST /fare-estimate
export async function fareEstimate(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  const trip = parseTripInput(body)
  const [area, settings] = await Promise.all([serviceAreaFor(trip.pickup), getPlatformSettings()])
  const couponCode = optionalString(body.couponCode, 40)
  const at = body.scheduledAt ? parseDate(body.scheduledAt, 'scheduledAt') : undefined

  const modes = [
    ...(settings.rideServiceEnabled && area.rideEnabled && trip.drops.length === 1 ? ['ride'] : []),
    ...(settings.transportServiceEnabled && area.transportEnabled ? ['transport'] : []),
  ].filter((m) => !body.mode || body.mode === m)
  const filter: Record<string, unknown> = { status: 'active', mode: { $in: modes } }
  if (body.categoryKey) filter.key = body.categoryKey
  const categories = await ServiceCategory.find(filter).sort({ mode: 1, sortOrder: 1 })

  // Categories are priced in parallel: each one only reads (cached) rules.
  const results = await Promise.all(categories.map(async (category) => ({ category, priced: await priceCategory(category, trip, area._id, at) })))
  const estimates = []
  for (const { category, priced } of results) {
    if (!priced) continue
    let coupon: { code: string; discount: number } | { error: string } | undefined
    if (couponCode) {
      try {
        const applied = await applyCoupon({ code: couponCode, customerId: customerDoc(req)._id, mode: category.mode, categoryKey: category.key, serviceAreaId: area._id, fareTotal: priced.fare.total })
        coupon = { code: applied.code, discount: applied.discount }
        priced.fare.discount = applied.discount
        priced.fare.total -= applied.discount
      } catch (err) {
        if (!(err instanceof HttpError)) throw err
        coupon = { error: err.message }
      }
    }
    estimates.push({ categoryKey: category.key, mode: category.mode, name: category.name, icon: category.icon, ...priced, ...(coupon ? { coupon } : {}) })
  }

  res.json({ serviceArea: { id: area.id, name: area.name, city: area.city }, estimates })
}

// ---------- Create and list ----------

// POST /bookings
export async function createBooking(req: Request, res: Response) {
  const customer = customerDoc(req)
  const body = req.body as Record<string, unknown>
  if (!isProfileComplete(req.appUser!)) throw new HttpError(403, 'Please complete your profile before booking')

  const category = await ServiceCategory.findOne({ key: requireString(body.categoryKey, 'categoryKey', 60), status: 'active' })
  if (!category) throw new HttpError(400, 'Unknown vehicle category')
  if (body.mode !== undefined && body.mode !== category.mode) throw new HttpError(400, `${category.name} is a ${category.mode} category`)
  const mode = category.mode

  const paymentMethod = (body.paymentMethod ?? 'cash') as (typeof PAYMENT_METHODS)[number]
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new HttpError(400, `paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`)

  const trip = parseTripInput(body)
  if (mode === 'ride' && trip.drops.length > 1) throw new HttpError(400, 'Rides have a single drop')
  if (mode === 'transport' && !trip.goods?.description) throw new HttpError(400, 'goods.description is required for transport bookings')

  const [area, settings] = await Promise.all([serviceAreaFor(trip.pickup), getPlatformSettings()])
  const modeEnabled = mode === 'ride' ? settings.rideServiceEnabled && area.rideEnabled : settings.transportServiceEnabled && area.transportEnabled
  if (!modeEnabled) throw new HttpError(422, `${mode === 'ride' ? 'Rides are' : 'Transport is'} not available at this location right now`)

  const scheduledAt = parseDate(body.scheduledAt, 'scheduledAt')
  if (scheduledAt) {
    const minutesAhead = (scheduledAt.getTime() - Date.now()) / 60_000
    if (minutesAhead < MIN_SCHEDULE_AHEAD_MIN || minutesAhead > MAX_SCHEDULE_DAYS * 1440) {
      throw new HttpError(400, `Scheduled bookings must be between ${MIN_SCHEDULE_AHEAD_MIN} minutes and ${MAX_SCHEDULE_DAYS} days ahead`)
    }
  } else {
    const ongoing = await Booking.findOne({ customer: customer._id, status: { $in: ['requested', ...ACTIVE_TRIP_STATUSES] } }).select('_id bookingCode')
    if (ongoing) throw new HttpError(409, `You already have an ongoing booking (${ongoing.bookingCode})`, { bookingId: ongoing.id })
  }

  const priced = await priceCategory(category, trip, area._id, scheduledAt)
  if (!priced) throw new HttpError(422, `${category.name} is not available in ${area.city} right now`)

  let couponCode: string | undefined
  if (body.couponCode) {
    const applied = await applyCoupon({ code: String(body.couponCode), customerId: customer._id, mode, categoryKey: category.key, serviceAreaId: area._id, fareTotal: priced.fare.total })
    couponCode = applied.code
    priced.fare.discount = applied.discount
    priced.fare.total -= applied.discount
  }

  if (paymentMethod === 'wallet') {
    const wallet = await getOrCreateWallet('customer', customer._id)
    if (wallet.balance < priced.fare.total) throw new HttpError(402, 'Not enough wallet balance for this booking', { balance: wallet.balance, required: priced.fare.total })
  }

  const lastDrop = trip.drops[trip.drops.length - 1]
  const status: BookingStatus = scheduledAt ? 'scheduled' : 'requested'
  const booking = await Booking.create({
    bookingCode: generateBookingCode(),
    mode,
    categoryKey: category.key,
    customer: customer._id,
    pickup: trip.pickup,
    drop: { address: lastDrop.address, lat: lastDrop.lat, lng: lastDrop.lng },
    stops: mode === 'transport' ? trip.drops.map((d) => ({ ...d, otp: generateTripOtp() })) : [],
    goodsDetails: mode === 'transport' ? trip.goods : undefined,
    status,
    scheduledAt: scheduledAt ?? null,
    fare: priced.fare,
    couponCode,
    distanceKm: priced.distanceKm,
    durationMin: priced.durationMin,
    paymentMethod,
    serviceArea: area._id,
    startOtp: generateTripOtp(),
    timeline: [{ status, note: scheduledAt ? `Scheduled for ${scheduledAt.toISOString()}` : 'Booking created' }],
  })
  if (couponCode) await Coupon.updateOne({ code: couponCode }, { $inc: { usedCount: 1 } })

  joinBookingRoom(booking.id, { customerId: customer._id })
  emitBookingEvent(booking.id, 'booking:status', { bookingId: booking.id, status, timestamp: new Date().toISOString() }, ['admin'])
  if (status === 'requested') startDispatch(booking.id)

  res.status(201).json(serializeBooking(booking, { viewer: 'customer' }))
}

// GET /bookings?mode=&status=&from=&to=
export async function listBookings(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const filter: FilterQuery<BookingDocument> = { customer: customerDoc(req)._id }
  if (req.query.mode === 'ride' || req.query.mode === 'transport') filter.mode = req.query.mode
  if (typeof req.query.status === 'string' && req.query.status) {
    const statuses = req.query.status.split(',').map((s) => s.trim())
    if (statuses.some((s) => !BOOKING_STATUSES.includes(s as BookingStatus))) throw new HttpError(400, `status must be one of: ${BOOKING_STATUSES.join(', ')}`)
    filter.status = { $in: statuses as BookingStatus[] }
  }
  const from = parseDate(req.query.from, 'from')
  const to = parseDate(req.query.to, 'to', true)
  if (from || to) filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) }

  const [items, total] = await Promise.all([
    Booking.find(filter).populate('driver', RIDER_PUBLIC_FIELDS).populate('vehicle', VEHICLE_PUBLIC_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Booking.countDocuments(filter),
  ])
  res.json({ items: items.map((b) => serializeBooking(b, { viewer: 'customer' })), total, page, limit })
}

// GET /bookings/:id
export async function getBooking(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  const [full, rating] = await Promise.all([populated(booking.id), Rating.findOne({ booking: booking._id, ratedBy: 'customer' }).select('score comment')])
  res.json({ ...serializeBooking(full, { viewer: 'customer' }), myRating: rating })
}

// GET /bookings/:id/track: polling fallback for the socket's booking:rider_location.
export async function trackBooking(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  const driver = booking.driver ? await Driver.findById(booking.driver).select('currentLocation') : null
  const location = driver?.currentLocation?.lat != null ? driver.currentLocation : null

  const beforePickup = ['accepted', 'arriving', 'arrived'].includes(booking.status)
  const nextStop = booking.stops.find((s) => s.status === 'pending')
  const target = beforePickup ? booking.pickup : nextStop ?? booking.drop
  const etaMin =
    location && ACTIVE_TRIP_STATUSES.includes(booking.status) && target?.lat != null
      ? etaMinutes({ lat: location.lat!, lng: location.lng! }, { lat: target.lat, lng: target.lng! })
      : null

  res.json({
    bookingId: booking.id,
    status: booking.status,
    rider: location ? { lat: location.lat, lng: location.lng, heading: location.heading, updatedAt: location.updatedAt } : null,
    etaMin,
    etaTo: beforePickup ? 'pickup' : 'drop',
  })
}

// ---------- During the trip ----------

// PATCH /bookings/:id/drop
export async function changeDrop(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  if (!DROP_CHANGEABLE.includes(booking.status)) throw new HttpError(409, 'The drop can only be changed once a rider is assigned and before the trip ends')
  const drop = parsePlace((req.body as { drop?: unknown }).drop, 'drop')
  const area = await findServiceArea(drop)
  if (!area) throw new HttpError(422, "We don't operate at this drop location")

  if (booking.mode === 'transport') {
    const lastPending = [...booking.stops].reverse().find((s) => s.status === 'pending')
    if (!lastPending) throw new HttpError(409, 'All drops have been completed')
    lastPending.set({ address: drop.address, lat: drop.lat, lng: drop.lng })
  }
  booking.drop = { address: drop.address, lat: drop.lat, lng: drop.lng }
  const fare = await repriceBooking(booking)
  booking.timeline.push({ status: booking.status, at: new Date(), note: 'Drop location changed by customer' })
  await booking.save()

  const event = { bookingId: booking.id, fare, distanceKm: booking.distanceKm, drop: booking.drop }
  emitBookingEvent(booking.id, 'booking:fare_updated', event, ['customer', 'rider'])
  res.json(serializeBooking(await populated(booking.id), { viewer: 'customer' }))
}

// POST /bookings/:id/cancel
export async function cancelBooking(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  if (!CUSTOMER_CANCELLABLE.includes(booking.status)) throw new HttpError(409, 'This booking can no longer be cancelled')
  const reason = optionalString((req.body ?? {}).reason, 300) ?? 'Cancelled by customer'

  const settings = await getPlatformSettings()
  const charge = await customerCancellationCharge(booking, settings.freeCancellationMinutes)
  const offeredTo = booking.status === 'requested' ? booking.offer?.driver : null

  const cancelled = await Booking.findOneAndUpdate(
    { _id: booking._id, status: booking.status },
    {
      $set: { status: 'cancelled', cancellation: { by: 'customer', reason, chargedAmount: charge }, offer: { driver: null } },
      $push: { timeline: { status: 'cancelled', at: new Date(), note: reason } },
    },
    { new: true },
  )
  if (!cancelled) throw new HttpError(409, 'The booking changed in the meantime. Please refresh and try again.')

  stopDispatch(booking.id)
  await applyCancellationCharge(cancelled, charge)
  if (cancelled.couponCode) await Coupon.updateOne({ code: cancelled.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } })
  if (offeredTo) emitToRider(offeredTo, 'booking:request_expired', { bookingId: booking.id })
  if (cancelled.driver) {
    await Driver.updateOne({ _id: cancelled.driver, onlineStatus: 'on_trip' }, { onlineStatus: 'online' })
    await notifyUser('driver', cancelled.driver, { title: 'Trip cancelled', body: `The customer cancelled ${cancelled.bookingCode}`, data: { bookingId: booking.id, type: 'booking_cancelled' } })
  }

  emitBookingEvent(booking.id, 'booking:cancelled', { bookingId: booking.id, by: 'customer', reason, charge }, ['customer', 'rider', 'admin'])
  leaveBookingRoom(booking.id)
  res.json({ ...serializeBooking(cancelled, { viewer: 'customer' }), chargeApplied: charge })
}

// POST /bookings/:id/retry: search again after "no rider found".
export async function retryBooking(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  const retried = await Booking.findOneAndUpdate(
    { _id: booking._id, status: 'no_rider_found' },
    {
      $set: { status: 'requested', rejectedBy: [], dispatchAttempts: 0, offer: { driver: null } },
      $push: { timeline: { status: 'requested', at: new Date(), note: 'Customer retried the search' } },
    },
    { new: true },
  )
  if (!retried) throw new HttpError(409, 'Only bookings with no rider found can be retried')

  joinBookingRoom(retried.id, { customerId: retried.customer })
  emitBookingEvent(retried.id, 'booking:status', { bookingId: retried.id, status: 'requested', timestamp: new Date().toISOString() }, ['customer', 'admin'])
  startDispatch(retried.id)
  res.json(serializeBooking(retried, { viewer: 'customer' }))
}

// ---------- After the trip ----------

// POST /bookings/:id/rating: rate the rider and optionally tip from the wallet.
export async function rateRider(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  if (booking.status !== 'completed' || !booking.driver) throw new HttpError(409, 'You can rate the rider once the trip is completed')
  const body = req.body as Record<string, unknown>
  const score = parseScore(body.score)
  const comment = optionalString(body.comment, 500)
  const tip = body.tip !== undefined && body.tip !== 0 ? parseAmount(body.tip, 'tip', { min: 1, max: MAX_TIP }) : 0

  const claimed = await Booking.findOneAndUpdate({ _id: booking._id, ratedByCustomer: false }, { $set: { ratedByCustomer: true } })
  if (!claimed) throw new HttpError(409, 'You have already rated this trip')

  if (tip) {
    const ref = { referenceType: 'Booking', referenceId: booking._id }
    try {
      await debitWallet({ ownerType: 'customer', ownerId: booking.customer, amount: tip, reason: 'tip', ...ref })
    } catch (err) {
      await Booking.updateOne({ _id: booking._id }, { $set: { ratedByCustomer: false } })
      throw err
    }
    await creditWallet({ ownerType: 'driver', ownerId: booking.driver, amount: tip, reason: 'tip', ...ref })
    await Booking.updateOne({ _id: booking._id }, { $inc: { 'fare.tip': tip } })
  }

  const rating = await Rating.create({ booking: booking._id, customer: booking.customer, driver: booking.driver, ratedBy: 'customer', score, comment })
  await refreshAverageRating('driver', booking.driver)
  res.status(201).json({ rating, tip })
}

// GET /bookings/:id/invoice
export async function getInvoice(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  if (booking.status !== 'completed') throw new HttpError(409, 'The invoice is available once the trip is completed')
  res.json({ url: `${env.publicBaseUrl}/api/v1/public/invoices/${signInvoiceToken(booking.id)}`, expiresInDays: 7 })
}

// POST /bookings/:id/share: public live-tracking link for friends and family.
export async function shareBooking(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  if (!['requested', ...ACTIVE_TRIP_STATUSES].includes(booking.status)) throw new HttpError(409, 'Only ongoing trips can be shared')
  if (!booking.shareToken) {
    booking.shareToken = crypto.randomBytes(16).toString('base64url')
    await booking.save()
  }
  res.json({ url: `${env.publicBaseUrl}/api/v1/public/track/${booking.shareToken}`, token: booking.shareToken })
}

// POST /bookings/:id/call: number to call the rider without revealing either phone.
export async function callRider(req: Request, res: Response) {
  const booking = await findOwnBooking(req)
  if (!ACTIVE_TRIP_STATUSES.includes(booking.status) || !booking.driver) throw new HttpError(409, 'You can call the rider during an active trip')
  const driver = await Driver.findById(booking.driver).select('phone')
  if (!driver) throw new HttpError(404, 'Rider not found')
  res.json(await getTelephonyProvider().bridge(booking.id, customerDoc(req).phone, driver.phone))
}
