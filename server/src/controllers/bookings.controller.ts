import type { Request, Response } from 'express'
import { Types, type FilterQuery } from 'mongoose'
import { Booking, type BookingDocument } from '../models/Booking'
import { Driver, type DriverDocument } from '../models/Driver'
import { recordAudit } from '../utils/audit'

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
  if (q) filter.bookingCode = { $regex: q.trim(), $options: 'i' }

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
  if (mode === 'ride') filter.serviceType = { $in: ['rider', 'driver'] }

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

  booking.driver = new Types.ObjectId(driverId)
  if (vehicleId) booking.vehicle = new Types.ObjectId(vehicleId)
  if (booking.status === 'requested') booking.status = 'accepted'
  booking.timeline.push({ status: 'accepted', at: new Date(), note: 'Manually assigned by admin' })
  await booking.save()

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

  const populated = await Booking.findById(booking.id)
    .populate('customer', CUSTOMER_FIELDS)
    .populate('driver', DRIVER_FIELDS)
    .populate('vehicle', VEHICLE_FIELDS)

  res.json(populated)
}
