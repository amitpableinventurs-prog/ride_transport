import type { Request, Response } from 'express'
import { Types, type FilterQuery } from 'mongoose'
import { ACTIVE_TRIP_STATUSES, Booking, type BookingDocument, type BookingStatus } from '../models/Booking'
import { ChatMessage } from '../models/ChatMessage'
import { CoinTransaction } from '../models/CoinTransaction'
import { Customer } from '../models/Customer'
import { Driver, type DriverDocument } from '../models/Driver'
import { GatewayOrder } from '../models/GatewayOrder'
import { Payment } from '../models/Payment'
import { Rating } from '../models/Rating'
import { Refund } from '../models/Refund'
import { SosRequest } from '../models/SosRequest'
import { Ticket } from '../models/Ticket'
import { WalletTransaction } from '../models/WalletTransaction'
import { refreshAverageRating } from '../services/trips'
import { recordAudit } from '../utils/audit'
import { notifyUser } from '../utils/notify'
import { emitBookingEvent, joinBookingRoom, leaveBookingRoom } from '../realtime/socket'
import { startDispatch, stopDispatch } from '../services/dispatch'
import { searchRegex } from '../utils/regex'

const CUSTOMER_FIELDS = 'name phone email'
const DRIVER_FIELDS = 'name phone rating onlineStatus currentLocation'
const VEHICLE_FIELDS = 'registrationNumber model capacity'

export async function listBookings(req: Request, res: Response) {
  const { mode, status, paymentStatus, q } = req.query as {
    mode?: string
    status?: string
    paymentStatus?: string
    q?: string
  }
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20))

  const filter: FilterQuery<BookingDocument> = {}
  if (mode) filter.mode = mode as BookingDocument['mode']
  if (status) {
    const statuses = status.split(',').map((s) => s.trim()).filter(Boolean)
    filter.status = statuses.length > 1 ? { $in: statuses } : (statuses[0] as BookingDocument['status'])
  }
  if (paymentStatus) filter.paymentStatus = paymentStatus as BookingDocument['paymentStatus']
  if (q) filter.bookingCode = { $regex: searchRegex(q), $options: 'i' }

  const [items, total] = await Promise.all([
    Booking.find(filter)
      .populate('customer', CUSTOMER_FIELDS)
      .populate('driver', DRIVER_FIELDS)
      .populate('vehicle', VEHICLE_FIELDS)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Booking.countDocuments(filter),
  ])

  res.json({ items, total, page, limit })
}

export async function getBooking(req: Request, res: Response) {
  const booking = await Booking.findById(req.params.id)
    .populate('customer', CUSTOMER_FIELDS)
    .populate('driver', DRIVER_FIELDS)
    .populate('vehicle', VEHICLE_FIELDS)
    .populate('partner', 'companyName ownerName phone')

  if (!booking) {
    res.status(404).json({ message: 'Booking not found' })
    return
  }

  res.json(booking)
}

export async function listAvailableDrivers(req: Request, res: Response) {
  const { mode } = req.query as { mode?: string; categoryKey?: string }

  const filter: FilterQuery<DriverDocument> = { status: 'active', onlineStatus: 'online' }
  if (mode === 'ride') filter.serviceType = 'rider'
  if (mode === 'transport') filter.serviceType = 'transport'

  const drivers = await Driver.find(filter).select('name phone serviceType onlineStatus currentLocation rating').sort({ name: 1 })
  res.json(drivers)
}

export async function assignBooking(req: Request, res: Response) {
  const { driverId, vehicleId } = req.body as { driverId?: string; vehicleId?: string }
  if (!driverId) {
    res.status(400).json({ message: 'driverId is required' })
    return
  }

  const booking = await Booking.findById(req.params.id)
  if (!booking) {
    res.status(404).json({ message: 'Booking not found' })
    return
  }

  const previousDriver = booking.driver
  booking.driver = new Types.ObjectId(driverId)
  if (vehicleId) booking.vehicle = new Types.ObjectId(vehicleId)
  if (booking.status === 'requested' || booking.status === 'no_rider_found') {
    booking.status = 'accepted'
    booking.acceptedAt = new Date()
  }
  booking.set('offer', { driver: null })
  booking.timeline.push({ status: 'accepted', at: new Date(), note: 'Manually assigned by admin' })
  await booking.save()

  // Keep the apps in sync: stop matching, move rider availability, notify both sides.
  stopDispatch(booking.id)
  if (previousDriver && !previousDriver.equals(booking.driver)) {
    await Driver.updateOne({ _id: previousDriver, onlineStatus: 'on_trip' }, { onlineStatus: 'online' })
    leaveBookingRoom(booking.id, { driverId: previousDriver })
  }
  await Driver.updateOne({ _id: booking.driver }, { onlineStatus: 'on_trip' })
  joinBookingRoom(booking.id, { customerId: booking.customer, driverId: booking.driver })
  const rider = await Driver.findById(booking.driver).select('name rating photoUrl')
  emitBookingEvent(booking.id, 'booking:rider_assigned', { bookingId: booking.id, rider, vehicle: booking.vehicle, etaMin: null }, ['customer'])
  emitBookingEvent(booking.id, 'booking:status', { bookingId: booking.id, status: booking.status, timestamp: new Date().toISOString() }, ['customer', 'rider', 'admin'])
  await notifyUser('driver', booking.driver, { title: 'Trip assigned', body: `Booking ${booking.bookingCode} was assigned to you`, data: { bookingId: booking.id, type: 'trip_assigned' } })

  await recordAudit(req.admin!, 'booking.assigned', 'Booking', booking.bookingCode, { driverId, vehicleId })

  const populated = await Booking.findById(booking.id)
    .populate('customer', CUSTOMER_FIELDS)
    .populate('driver', DRIVER_FIELDS)
    .populate('vehicle', VEHICLE_FIELDS)

  res.json(populated)
}

export async function updateBookingStatus(req: Request, res: Response) {
  const { status, note, cancelledBy, reason } = req.body as {
    status?: BookingDocument['status']
    note?: string
    cancelledBy?: 'customer' | 'driver' | 'admin'
    reason?: string
  }

  if (!status) {
    res.status(400).json({ message: 'status is required' })
    return
  }

  const booking = await Booking.findById(req.params.id)
  if (!booking) {
    res.status(404).json({ message: 'Booking not found' })
    return
  }

  if (['accepted', 'arriving', 'arrived', 'started', 'in_transit', 'completed'].includes(status) && !booking.driver) {
    res.status(409).json({ message: 'Assign a rider before moving this booking to an active trip status' })
    return
  }

  booking.status = status
  if (status === 'cancelled') {
    booking.cancellation = {
      by: cancelledBy ?? 'admin',
      reason: reason ?? note ?? 'Cancelled by admin',
      chargedAmount: booking.cancellation?.chargedAmount ?? 0,
    }
  }
  booking.timeline.push({ status, at: new Date(), note })
  await booking.save()

  await recordAudit(req.admin!, 'booking.status_changed', 'Booking', booking.bookingCode, { status, note, reason })

  if (status === 'cancelled') {
    stopDispatch(booking.id)
    if (booking.driver) await Driver.updateOne({ _id: booking.driver, onlineStatus: 'on_trip' }, { onlineStatus: 'online' })
    emitBookingEvent(booking.id, 'booking:cancelled', { bookingId: booking.id, by: booking.cancellation?.by ?? 'admin', reason: booking.cancellation?.reason, charge: 0 }, ['customer', 'rider', 'admin'])
    leaveBookingRoom(booking.id)
  } else {
    emitBookingEvent(booking.id, 'booking:status', { bookingId: booking.id, status, timestamp: new Date().toISOString() }, ['customer', 'rider', 'admin'])
    if (status === 'requested') startDispatch(booking.id)
  }

  const populated = await Booking.findById(booking.id)
    .populate('customer', CUSTOMER_FIELDS)
    .populate('driver', DRIVER_FIELDS)
    .populate('vehicle', VEHICLE_FIELDS)

  res.json(populated)
}

// Bookings that are still being dispatched or driven; they must be cancelled before they can be deleted.
const UNDELETABLE_STATUSES: BookingStatus[] = ['scheduled', 'requested', ...ACTIVE_TRIP_STATUSES]

// DELETE /bookings/:id: removes a booking that has no money or support records attached
// (payments, refunds, wallet entries, coins, SOS, tickets stay for the accounts and audits).
export async function deleteBooking(req: Request, res: Response) {
  const booking = await Booking.findById(req.params.id)
  if (!booking) {
    res.status(404).json({ message: 'Booking not found' })
    return
  }
  if (UNDELETABLE_STATUSES.includes(booking.status)) {
    res.status(409).json({ message: `Cannot delete: this booking is ${booking.status.replace(/_/g, ' ')}. Cancel it first.` })
    return
  }

  const ref = { booking: booking._id }
  const [payments, refunds, walletEntries, coins, sos, tickets] = await Promise.all([
    Payment.countDocuments(ref),
    Refund.countDocuments(ref),
    WalletTransaction.countDocuments({ referenceType: 'Booking', referenceId: booking._id }),
    CoinTransaction.countDocuments(ref),
    SosRequest.countDocuments(ref),
    Ticket.countDocuments(ref),
  ])
  const kept = [
    payments && 'payments',
    refunds && 'refunds',
    walletEntries && 'wallet entries',
    coins && 'coin rewards',
    sos && 'SOS alerts',
    tickets && 'support tickets',
  ].filter(Boolean)
  if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'refunded' || kept.length) {
    res.status(409).json({ message: `Cannot delete: this booking has ${kept.length ? kept.join(', ') : 'a payment'} on record. It is kept for the accounts.` })
    return
  }

  const ratings = await Rating.find(ref).select('driver customer ratedBy')
  await Promise.all([
    ChatMessage.deleteMany(ref),
    // Only unpaid checkouts can be left (a paid one would have a payment record).
    GatewayOrder.deleteMany({ ...ref, status: { $ne: 'paid' } }),
    Rating.deleteMany(ref),
  ])
  await booking.deleteOne()

  await Promise.all(
    ratings.map((r) => {
      if (r.ratedBy === 'customer') return r.driver ? refreshAverageRating('driver', r.driver) : null
      return r.customer ? refreshAverageRating('customer', r.customer) : null
    }),
  )
  if (booking.status === 'completed') {
    await Promise.all([
      booking.driver ? Driver.updateOne({ _id: booking.driver, totalTrips: { $gt: 0 } }, { $inc: { totalTrips: -1 } }) : null,
      Customer.updateOne({ _id: booking.customer, totalBookings: { $gt: 0 } }, { $inc: { totalBookings: -1 } }),
    ])
  }

  await recordAudit(req.admin!, 'booking.deleted', 'Booking', booking.bookingCode, {
    status: booking.status,
    mode: booking.mode,
    fare: booking.fare?.total ?? 0,
  })
  res.json({ message: 'Booking deleted' })
}
