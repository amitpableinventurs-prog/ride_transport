import type { Request, Response } from 'express'
import { Admin } from '../models/Admin'
import { hashPassword } from '../utils/password'
import { recordAudit } from '../utils/audit'
import { env } from '../config/env'
import type { RoleKey } from '../types/rbac'

export async function listAdmins(_req: Request, res: Response) {
  const admins = await Admin.find().select('-passwordHash').sort({ createdAt: 1 })
  res.json(admins)
}

export async function createAdmin(req: Request, res: Response) {
  const { name, email, phone, role } = req.body as { name?: string; email?: string; phone?: string; role?: RoleKey }
  if (!name || !email || !phone || !role) {
    res.status(400).json({ message: 'name, email, phone and role are required' })
    return
  }

  const existing = await Admin.findOne({ email: email.trim().toLowerCase() })
  if (existing) {
    res.status(409).json({ message: 'An admin with this email already exists' })
    return
  }

  const passwordHash = await hashPassword(env.seedAdminPassword)
  const admin = await Admin.create({ name, email: email.trim().toLowerCase(), phone, role, passwordHash })

  await recordAudit(req.admin!, 'admin.create', 'AdminUser', `${admin.name} (${admin.email})`)

  const { passwordHash: _omit, ...safe } = admin.toJSON()
  res.status(201).json(safe)
}

export async function updateAdmin(req: Request, res: Response) {
  const target = await Admin.findById(req.params.id)
  if (!target) {
    res.status(404).json({ message: 'Admin not found' })
    return
  }

  const body = req.body as Partial<{ name: string; phone: string; role: RoleKey; status: 'active' | 'suspended' }>

  if (target.id === req.admin!.id && target.role === 'super_admin') {
    if (body.status === 'suspended' || (body.role && body.role !== 'super_admin')) {
      res.status(400).json({ message: 'You cannot suspend or demote your own Super Admin account' })
      return
    }
  }

  if (body.name !== undefined) target.name = body.name
  if (body.phone !== undefined) target.phone = body.phone
  if (body.role !== undefined) target.role = body.role
  if (body.status !== undefined) target.status = body.status
  await target.save()

  await recordAudit(
    req.admin!,
    body.status ? 'admin.status_changed' : 'admin.updated',
    'AdminUser',
    `${target.name} (${target.email})`,
    body.status ? { status: body.status } : undefined,
  )

  const { passwordHash: _omit, ...safe } = target.toJSON()
  res.json(safe)
}
