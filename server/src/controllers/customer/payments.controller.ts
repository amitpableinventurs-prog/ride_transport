// Customer app: wallet and online payments.
import type { Request, Response } from 'express'
import { Booking } from '../../models/Booking'
import { WalletTransaction } from '../../models/WalletTransaction'
import { createGatewayOrder, verifyGatewayPayment } from '../../services/gatewayPayments'
import { HttpError, parseAmount, parsePagination, requireObjectId } from '../../utils/http'
import { getOrCreateWallet } from '../../utils/wallet'

const MIN_TOPUP = 10
const MAX_TOPUP = 10_000

// GET /wallet
export async function getWallet(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const wallet = await getOrCreateWallet('customer', req.appUser!.doc._id)
  const [transactions, total] = await Promise.all([
    WalletTransaction.find({ wallet: wallet._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
    WalletTransaction.countDocuments({ wallet: wallet._id }),
  ])
  // A negative balance is unpaid cancellation charges.
  res.json({ balance: wallet.balance, currency: wallet.currency, dues: Math.max(0, -wallet.balance), transactions: { items: transactions, total, page, limit } })
}

// POST /wallet/topup
export async function topUpWallet(req: Request, res: Response) {
  const amount = parseAmount((req.body as { amount?: unknown }).amount, 'amount', { min: MIN_TOPUP, max: MAX_TOPUP })
  res.status(201).json(await createGatewayOrder({ purpose: 'wallet_topup', ownerType: 'customer', ownerId: req.appUser!.doc._id, amount }))
}

// POST /payments/order: pay a completed booking online.
export async function createPaymentOrder(req: Request, res: Response) {
  const booking = await Booking.findOne({ _id: requireObjectId((req.body as { bookingId?: unknown }).bookingId, 'bookingId'), customer: req.appUser!.doc._id })
  if (!booking) throw new HttpError(404, 'Booking not found')
  if (booking.status !== 'completed') throw new HttpError(409, 'Payment opens once the trip is completed')
  if (booking.paymentStatus !== 'pending') throw new HttpError(409, 'This booking is already paid')

  res.status(201).json(
    await createGatewayOrder({ purpose: 'booking', ownerType: 'customer', ownerId: req.appUser!.doc._id, amount: booking.fare?.total ?? 0, booking: booking._id }),
  )
}

// POST /payments/verify: booking payments and wallet top-ups.
export async function verifyPayment(req: Request, res: Response) {
  res.json(await verifyGatewayPayment({ type: 'customer', id: req.appUser!.doc._id }, req.body as Record<string, unknown>))
}
