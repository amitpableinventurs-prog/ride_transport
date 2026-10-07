import type { Request, Response } from 'express'
import { Driver } from '../models/Driver'
import { recordAudit } from '../utils/audit'
import { searchRegex } from '../utils/regex'

function parsePagination(req: Request) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
  return { page, limit, skip: (page - 1) * limit }
}


// Backs both the "Riders" and "Drivers" nav pages (SRS section 9) — a single
// Driver collection distinguished by serviceType, filtered via ?serviceType=.
export async function listDrivers(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const serviceType = typeof req.query.serviceType === 'string' ? req.query.serviceType : undefined
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const approvalStatus = typeof req.query.approvalStatus === 'string' ? req.query.approvalStatus : undefined

  const filter: Record<string, unknown> = {}
  if (serviceType) filter.serviceType = serviceType
  if (status) filter.status = status
  if (approvalStatus) filter.approvalStatus = approvalStatus
  if (q) {
    const re = new RegExp(searchRegex(q), 'i')
    filter.$or = [{ name: re }, { email: re }, { phone: re }]
  }

  const [items, total] = await Promise.all([
    Driver.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Driver.countDocuments(filter),
  ])

  res.json({ items, total, page, limit })
}

export async function updateDriver(req: Request, res: Response) {
  const driver = await Driver.findById(req.params.id)
  if (!driver) {
    res.status(404).json({ message: 'Driver not found' })
    return
  }

  const body = req.body as Partial<{
    approvalStatus: 'pending' | 'verified' | 'rejected'
    status: 'active' | 'suspended' | 'blocked'
    rejectionReason: string
  }>

  if (body.approvalStatus !== undefined) {
    driver.approvalStatus = body.approvalStatus
    // Shown to the rider in the app's approval status screen.
    driver.rejectionReason = body.approvalStatus === 'rejected' ? body.rejectionReason?.trim() || undefined : undefined
  }
  if (body.status !== undefined) driver.status = body.status
  await driver.save()

  const action = body.approvalStatus ? 'driver.approval_changed' : 'driver.status_changed'
  await recordAudit(req.admin!, action, 'Driver', `${driver.name} (${driver.phone})`, {
    approvalStatus: body.approvalStatus,
    status: body.status,
  })

  res.json(driver)
}
