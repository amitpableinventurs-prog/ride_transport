// Rider payout requests: the amount was held from the rider's wallet when they asked for it.
import type { Request, Response } from 'express'
import { Withdrawal } from '../models/Withdrawal'
import { recordAudit } from '../utils/audit'
import { HttpError, requireString } from '../utils/http'
import { notifyUser } from '../utils/notify'
import { creditWallet } from '../utils/wallet'

const OPEN_STATUSES = ['requested', 'processing']

function parsePagination(query: Record<string, string>) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))
  return { page, pageSize }
}

// GET /withdrawals?status=
export async function listWithdrawals(req: Request, res: Response) {
  const query = req.query as Record<string, string>
  const filter: Record<string, unknown> = {}
  if (query.status) filter.status = query.status
  const { page, pageSize } = parsePagination(query)

  const [items, total] = await Promise.all([
    Withdrawal.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: 'driver', select: 'name phone' }),
    Withdrawal.countDocuments(filter),
  ])
  res.json({ items, total, page, pageSize })
}

// PATCH /withdrawals/:id/processing: the admin has started the bank / UPI transfer.
export async function markWithdrawalProcessing(req: Request, res: Response) {
  const withdrawal = await Withdrawal.findOneAndUpdate({ _id: req.params.id, status: 'requested' }, { $set: { status: 'processing' } }, { new: true })
  if (!withdrawal) throw new HttpError(409, 'Only new requests can be moved to processing')
  await recordAudit(req.admin!, 'withdrawal.processing', 'Withdrawal', String(withdrawal._id), { amount: withdrawal.amount })
  res.json(await withdrawal.populate({ path: 'driver', select: 'name phone' }))
}

// PATCH /withdrawals/:id/paid { reference }: the transfer is done; `reference` is the UTR / transaction id.
export async function markWithdrawalPaid(req: Request, res: Response) {
  const reference = requireString((req.body ?? {}).reference, 'reference', 100)
  const withdrawal = await Withdrawal.findOneAndUpdate(
    { _id: req.params.id, status: { $in: OPEN_STATUSES } },
    { $set: { status: 'paid', reference, processedAt: new Date() } },
    { new: true },
  )
  if (!withdrawal) throw new HttpError(409, 'This payout is not open')

  await recordAudit(req.admin!, 'withdrawal.paid', 'Withdrawal', String(withdrawal._id), { amount: withdrawal.amount, reference })
  await notifyUser('driver', withdrawal.driver, {
    title: 'Payout sent',
    body: `₹${withdrawal.amount} has been sent to your ${withdrawal.method === 'upi' ? 'UPI ID' : 'bank account'}. Reference: ${reference}`,
    data: { type: 'withdrawal', withdrawalId: withdrawal.id, status: 'paid' },
  })
  res.json(await withdrawal.populate({ path: 'driver', select: 'name phone' }))
}

// PATCH /withdrawals/:id/reject { reason }: the held amount goes back to the rider's wallet.
export async function rejectWithdrawal(req: Request, res: Response) {
  const reason = requireString((req.body ?? {}).reason, 'reason', 300)
  const withdrawal = await Withdrawal.findOneAndUpdate(
    { _id: req.params.id, status: { $in: OPEN_STATUSES } },
    { $set: { status: 'rejected', rejectionReason: reason, processedAt: new Date() } },
    { new: true },
  )
  if (!withdrawal) throw new HttpError(409, 'This payout is not open')

  await creditWallet({ ownerType: 'driver', ownerId: withdrawal.driver, amount: withdrawal.amount, reason: 'withdrawal', referenceType: 'Withdrawal', referenceId: withdrawal._id })
  await recordAudit(req.admin!, 'withdrawal.rejected', 'Withdrawal', String(withdrawal._id), { amount: withdrawal.amount, reason })
  await notifyUser('driver', withdrawal.driver, {
    title: 'Payout request declined',
    body: `₹${withdrawal.amount} is back in your wallet. Reason: ${reason}`,
    data: { type: 'withdrawal', withdrawalId: withdrawal.id, status: 'rejected' },
  })
  res.json(await withdrawal.populate({ path: 'driver', select: 'name phone' }))
}
