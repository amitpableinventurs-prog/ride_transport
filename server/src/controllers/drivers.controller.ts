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
    Driver.find(filter).populate('assignedVehicle', 'registrationNumber model').sort({ createdAt: -1 }).skip(skip).limit(limit),
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
    name: string
    email: string
    gender: 'male' | 'female' | 'other'
    dateOfBirth: string
  }>

  if (body.approvalStatus !== undefined) {
    driver.approvalStatus = body.approvalStatus
    // Shown to the rider in the app's approval status screen.
    driver.rejectionReason = body.approvalStatus === 'rejected' ? body.rejectionReason?.trim() || undefined : undefined
  }
  if (body.status !== undefined) driver.status = body.status

  // Profile corrections made while reviewing the account.
  if (body.name !== undefined) driver.name = String(body.name).trim().slice(0, 80)
  if (body.email !== undefined) driver.email = String(body.email).trim().toLowerCase() || undefined
  if (body.gender !== undefined) {
    if (!['male', 'female', 'other'].includes(body.gender)) {
      res.status(400).json({ message: 'gender must be male, female or other' })
      return
    }
    driver.gender = body.gender
  }
  if (body.dateOfBirth !== undefined) {
    const dob = new Date(body.dateOfBirth)
    if (Number.isNaN(dob.getTime())) {
      res.status(400).json({ message: 'dateOfBirth is not a valid date' })
      return
    }
    driver.dateOfBirth = dob
  }

  try {
    await driver.save()
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      res.status(409).json({ message: 'Another account already uses this email' })
      return
    }
    throw err
  }
  await driver.populate('assignedVehicle', 'registrationNumber model')

  const action = body.approvalStatus ? 'driver.approval_changed' : body.status ? 'driver.status_changed' : 'driver.updated'
  await recordAudit(req.admin!, action, 'Driver', `${driver.name} (${driver.phone})`, {
    approvalStatus: body.approvalStatus,
    status: body.status,
  })

  res.json(driver)
}
