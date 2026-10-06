import type { Request, Response } from 'express'
import { Refund } from '../models/Refund'
import { Booking } from '../models/Booking'
import { Wallet } from '../models/Wallet'
import { WalletTransaction } from '../models/WalletTransaction'
import { recordAudit } from '../utils/audit'

function parsePagination(query: Record<string, string>) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))
  return { page, pageSize }
}

export async function listRefunds(req: Request, res: Response) {
  const query = req.query as Record<string, string>
  const { status } = query
  const filter: Record<string, unknown> = {}
  if (status) filter.status = status

  const { page, pageSize } = parsePagination(query)

  const [items, total] = await Promise.all([
    Refund.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: 'booking', select: 'bookingCode' }),
    Refund.countDocuments(filter),
  ])

  res.json({ items, total, page, pageSize })
}

export async function approveRefund(req: Request, res: Response) {
  const refund = await Refund.findById(req.params.id)
  if (!refund) {
    res.status(404).json({ message: 'Refund not found' })
    return
  }
  if (refund.status !== 'requested') {
    res.status(400).json({ message: 'Only requested refunds can be approved' })
    return
  }

  refund.status = 'approved'
  refund.approvedBy = req.admin!._id
  await refund.save()

  await recordAudit(req.admin!, 'refund.approved', 'Refund', String(refund._id), { amount: refund.amount })
  res.json(refund)
}

export async function rejectRefund(req: Request, res: Response) {
  const refund = await Refund.findById(req.params.id)
  if (!refund) {
    res.status(404).json({ message: 'Refund not found' })
    return
  }
  if (refund.status !== 'requested') {
    res.status(400).json({ message: 'Only requested refunds can be rejected' })
    return
  }

  const { reason } = req.body as { reason?: string }
  refund.status = 'rejected'
  refund.approvedBy = req.admin!._id
  await refund.save()

  await recordAudit(req.admin!, 'refund.rejected', 'Refund', String(refund._id), reason ? { reason } : undefined)
  res.json(refund)
}

export async function processRefund(req: Request, res: Response) {
  const refund = await Refund.findById(req.params.id)
  if (!refund) {
    res.status(404).json({ message: 'Refund not found' })
    return
  }
  if (refund.status !== 'approved') {
    res.status(400).json({ message: 'Only approved refunds can be processed' })
    return
  }

  const booking = await Booking.findById(refund.booking).select('customer bookingCode')
  if (!booking) {
    res.status(404).json({ message: 'Related booking not found' })
    return
  }

  let wallet = await Wallet.findOne({ ownerType: 'customer', ownerId: booking.customer })
  if (!wallet) {
    wallet = await Wallet.create({ ownerType: 'customer', ownerId: booking.customer, balance: 0, currency: 'INR' })
  }

  const updatedWallet = await Wallet.findByIdAndUpdate(wallet._id, { $inc: { balance: refund.amount } }, { new: true })
  if (!updatedWallet) {
    res.status(500).json({ message: 'Could not credit customer wallet' })
    return
  }

  await WalletTransaction.create({
    wallet: wallet._id,
    type: 'credit',
    amount: refund.amount,
    reason: 'refund',
    referenceType: 'Refund',
    referenceId: refund._id,
    balanceAfter: updatedWallet.balance,
    createdBy: req.admin!._id,
  })

  refund.status = 'processed'
  refund.processedAt = new Date()
  await refund.save()

  await recordAudit(req.admin!, 'refund.processed', 'Refund', `${booking.bookingCode} - ${refund.amount}`)
  res.json(refund)
}
