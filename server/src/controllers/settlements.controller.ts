import type { Request, Response } from 'express'
import { Settlement } from '../models/Settlement'
import { Driver } from '../models/Driver'
import { TransportPartner } from '../models/TransportPartner'
import { recordAudit } from '../utils/audit'

type PayeeType = 'driver' | 'partner'

async function resolvePayeeName(payeeType: PayeeType, payeeId: unknown): Promise<string> {
  if (payeeType === 'driver') {
    const driver = await Driver.findById(payeeId).select('name')
    return driver?.name ?? 'Unknown driver'
  }
  const partner = await TransportPartner.findById(payeeId).select('companyName')
  return partner?.companyName ?? 'Unknown partner'
}

function parsePagination(query: Record<string, string>) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))
  return { page, pageSize }
}

export async function listSettlements(req: Request, res: Response) {
  const query = req.query as Record<string, string>
  const { payeeType, status } = query
  const filter: Record<string, unknown> = {}
  if (payeeType) filter.payeeType = payeeType
  if (status) filter.status = status

  const { page, pageSize } = parsePagination(query)

  const [settlements, total] = await Promise.all([
    Settlement.find(filter)
      .sort({ periodEnd: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
    Settlement.countDocuments(filter),
  ])

  const items = await Promise.all(
    settlements.map(async (settlement) => ({
      ...settlement.toJSON(),
      payeeName: await resolvePayeeName(settlement.payeeType as PayeeType, settlement.payeeId),
    })),
  )

  res.json({ items, total, page, pageSize })
}

export async function markSettlementPaid(req: Request, res: Response) {
  const settlement = await Settlement.findById(req.params.id)
  if (!settlement) {
    res.status(404).json({ message: 'Settlement not found' })
    return
  }
  if (settlement.status === 'paid') {
    res.status(400).json({ message: 'Settlement is already marked as paid' })
    return
  }

  settlement.status = 'paid'
  settlement.paidAt = new Date()
  await settlement.save()

  await recordAudit(req.admin!, 'settlement.paid', 'Settlement', `${settlement.payeeType}:${settlement.payeeId}`, {
    netPayable: settlement.netPayable,
  })

  res.json(settlement)
}
