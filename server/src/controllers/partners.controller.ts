import type { Request, Response } from 'express'
import { TransportPartner } from '../models/TransportPartner'
import { recordAudit } from '../utils/audit'

function parsePagination(req: Request) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
  return { page, limit, skip: (page - 1) * limit }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function listPartners(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const approvalStatus = typeof req.query.approvalStatus === 'string' ? req.query.approvalStatus : undefined

  const filter: Record<string, unknown> = {}
  if (status) filter.status = status
  if (approvalStatus) filter.approvalStatus = approvalStatus
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ companyName: re }, { ownerName: re }, { email: re }, { phone: re }]
  }

  const [items, total] = await Promise.all([
    TransportPartner.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    TransportPartner.countDocuments(filter),
  ])

  res.json({ items, total, page, limit })
}

export async function updatePartner(req: Request, res: Response) {
  const partner = await TransportPartner.findById(req.params.id)
  if (!partner) {
    res.status(404).json({ message: 'Transport partner not found' })
    return
  }

  const body = req.body as Partial<{
    approvalStatus: 'pending' | 'verified' | 'rejected'
    status: 'active' | 'suspended' | 'blocked'
  }>

  if (body.approvalStatus !== undefined) partner.approvalStatus = body.approvalStatus
  if (body.status !== undefined) partner.status = body.status
  await partner.save()

  const action = body.approvalStatus ? 'partner.approval_changed' : 'partner.status_changed'
  await recordAudit(req.admin!, action, 'TransportPartner', `${partner.companyName} (${partner.email ?? partner.phone})`, {
    approvalStatus: body.approvalStatus,
    status: body.status,
  })

  res.json(partner)
}
