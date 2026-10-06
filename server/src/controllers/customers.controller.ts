import type { Request, Response } from 'express'
import { Customer } from '../models/Customer'
import { recordAudit } from '../utils/audit'

function parsePagination(req: Request) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
  return { page, limit, skip: (page - 1) * limit }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function listCustomers(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const status = typeof req.query.status === 'string' ? req.query.status : undefined

  const filter: Record<string, unknown> = {}
  if (status) filter.status = status
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: re }, { email: re }, { phone: re }]
  }

  const [items, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Customer.countDocuments(filter),
  ])

  res.json({ items, total, page, limit })
}

export async function updateCustomerStatus(req: Request, res: Response) {
  const { status } = req.body as { status?: 'active' | 'suspended' | 'blocked' }
  if (!status || !['active', 'suspended', 'blocked'].includes(status)) {
    res.status(400).json({ message: 'A valid status is required' })
    return
  }

  const customer = await Customer.findById(req.params.id)
  if (!customer) {
    res.status(404).json({ message: 'Customer not found' })
    return
  }

  customer.status = status
  await customer.save()

  await recordAudit(req.admin!, 'customer.status_changed', 'Customer', `${customer.name} (${customer.email ?? customer.phone})`, { status })

  res.json(customer)
}
