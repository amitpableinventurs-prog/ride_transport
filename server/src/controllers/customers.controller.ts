import type { Request, Response } from 'express'
import { AppNotification } from '../models/AppNotification'
import { ACTIVE_TRIP_STATUSES, Booking, type BookingStatus } from '../models/Booking'
import { CoinTransaction } from '../models/CoinTransaction'
import { Customer } from '../models/Customer'
import { Device } from '../models/Device'
import { GatewayOrder } from '../models/GatewayOrder'
import { OtpCode } from '../models/OtpCode'
import { Wallet } from '../models/Wallet'
import { WalletTransaction } from '../models/WalletTransaction'
import { disconnectCustomer } from '../realtime/socket'
import { recordAudit } from '../utils/audit'
import { searchRegex } from '../utils/regex'

function parsePagination(req: Request) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
  return { page, limit, skip: (page - 1) * limit }
}


export async function listCustomers(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const status = typeof req.query.status === 'string' ? req.query.status : undefined

  const filter: Record<string, unknown> = {}
  if (status) filter.status = status
  if (q) {
    const re = new RegExp(searchRegex(q), 'i')
    filter.$or = [{ name: re }, { email: re }, { phone: re }]
  }

  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ])

  res.json({ items, total, page, limit })
}

// Status changes plus profile corrections (name, email, city, gender, date of birth).
export async function updateCustomer(req: Request, res: Response) {
  const body = req.body as Partial<{
    status: 'active' | 'suspended' | 'blocked'
    name: string
    email: string
    city: string
    gender: 'male' | 'female' | 'other'
    dateOfBirth: string
  }>

  if (body.status !== undefined && !['active', 'suspended', 'blocked'].includes(body.status)) {
    res.status(400).json({ message: 'A valid status is required' })
    return
  }
  if (body.gender !== undefined && !['male', 'female', 'other'].includes(body.gender)) {
    res.status(400).json({ message: 'gender must be male, female or other' })
    return
  }
  const dob = body.dateOfBirth !== undefined ? new Date(body.dateOfBirth) : undefined
  if (dob && Number.isNaN(dob.getTime())) {
    res.status(400).json({ message: 'dateOfBirth is not a valid date' })
    return
  }

  const customer = await Customer.findById(req.params.id)
  if (!customer) {
    res.status(404).json({ message: 'Customer not found' })
    return
  }

  if (body.status !== undefined) customer.status = body.status
  if (body.name !== undefined) customer.name = String(body.name).trim().slice(0, 80)
  if (body.email !== undefined) customer.email = String(body.email).trim().toLowerCase() || undefined
  if (body.city !== undefined) customer.city = String(body.city).trim().slice(0, 80) || undefined
  if (body.gender !== undefined) customer.gender = body.gender
  if (dob) customer.dateOfBirth = dob

  try {
    await customer.save()
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'Another account already uses this email' })
      return
    }
    throw err
  }

  await recordAudit(
    req.admin!,
    body.status ? 'customer.status_changed' : 'customer.updated',
    'Customer',
    `${customer.name} (${customer.email ?? customer.phone})`,
    body.status ? { status: body.status } : undefined,
  )

  res.json(customer)
}

// Bookings still being dispatched or driven; they must be cancelled before the customer can be deleted.
const UNDELETABLE_BOOKING_STATUSES: BookingStatus[] = ['scheduled', 'requested', ...ACTIVE_TRIP_STATUSES]

// DELETE /:id: removes the account with its wallet, coins, devices and notifications.
// Past bookings, payments, ratings, tickets and SOS records stay for the accounts and audits.
export async function deleteCustomer(req: Request, res: Response) {
  const customer = await Customer.findById(req.params.id)
  if (!customer) {
    res.status(404).json({ message: 'Customer not found' })
    return
  }

  const open = await Booking.findOne({ customer: customer._id, status: { $in: UNDELETABLE_BOOKING_STATUSES } }).select('bookingCode status')
  if (open) {
    res.status(409).json({ message: `Cannot delete: booking ${open.bookingCode} is ${open.status.replace(/_/g, ' ')}. Cancel it first.` })
    return
  }

  const wallet = await Wallet.findOne({ ownerType: 'customer', ownerId: customer._id })
  await Promise.all([
    wallet ? WalletTransaction.deleteMany({ wallet: wallet._id }) : null,
    CoinTransaction.deleteMany({ customer: customer._id }),
    Device.deleteMany({ userType: 'customer', userId: customer._id }),
    AppNotification.deleteMany({ userType: 'customer', userId: customer._id }),
    // Only unpaid checkouts; a paid one belongs to a payment record.
    GatewayOrder.deleteMany({ ownerType: 'customer', ownerId: customer._id, status: { $ne: 'paid' } }),
    OtpCode.deleteMany({ purpose: 'app_login', destination: `customer:${customer.phone}` }),
    // People this customer referred keep their accounts; the link to the deleted referrer goes.
    Customer.updateMany({ referredBy: customer._id }, { $set: { referredBy: null } }),
  ])
  if (wallet) await wallet.deleteOne()
  await customer.deleteOne()
  disconnectCustomer(customer._id)

  await recordAudit(req.admin!, 'customer.deleted', 'Customer', `${customer.name || 'No name'} (${customer.phone})`, {
    walletBalance: wallet?.balance ?? 0,
    coins: customer.coins ?? 0,
    totalBookings: customer.totalBookings,
    deletionRequested: Boolean(customer.deletionRequestedAt),
  })
  res.json({ message: 'Customer deleted' })
}
