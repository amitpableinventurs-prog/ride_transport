import type { Request, Response } from 'express'
import { Refund } from '../models/Refund'
import { createRefund as createRefundRecord, getRefundableInfo, processRefund as processRefundRecord } from '../services/refunds'
import { recordAudit } from '../utils/audit'
import { parseAmount, requireString } from '../utils/http'

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

// GET /refunds/booking-info?bookingCode=: amount left to refund and where it will go.
export async function getRefundBookingInfo(req: Request, res: Response) {
  const query = req.query as Record<string, string>
  res.json(await getRefundableInfo({ bookingCode: query.bookingCode, bookingId: query.bookingId }))
}

// POST /refunds: an admin raises a refund for a paid booking; it then goes through approve and process.
export async function createRefund(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>
  const amount = parseAmount(body.amount, 'amount', { min: 1, max: 100_000 })
  const reason = requireString(body.reason, 'reason', 300)
  const refund = await createRefundRecord({ bookingCode: body.bookingCode, bookingId: body.bookingId, amount, reason, requestedBy: req.admin!.name || req.admin!.email })
  await recordAudit(req.admin!, 'refund.created', 'Refund', String(refund._id), { amount })
  res.status(201).json(await refund.populate({ path: 'booking', select: 'bookingCode' }))
}

// PATCH /refunds/:id/process: online payments go back to the bank / card through Razorpay, others to the wallet.
export async function processRefund(req: Request, res: Response) {
  const { refund, bookingCode } = await processRefundRecord(String(req.params.id))
  await recordAudit(req.admin!, 'refund.processed', 'Refund', `${bookingCode} - ${refund.amount}`, {
    destination: refund.destination,
    ...(refund.gatewayRefundId ? { gatewayRefundId: refund.gatewayRefundId } : {}),
  })
  res.json(await refund.populate({ path: 'booking', select: 'bookingCode' }))
}
