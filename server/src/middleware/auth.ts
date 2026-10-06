import type { NextFunction, Request, Response } from 'express'
import { Admin } from '../models/Admin'
import { Role } from '../models/Role'
import { verifyAccessToken } from '../utils/jwt'
import type { PermissionKey } from '../types/rbac'

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const payload = token ? verifyAccessToken(token) : null

  if (!payload) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const admin = await Admin.findById(payload.sub)
  if (!admin || admin.status === 'suspended') {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const role = await Role.findOne({ key: admin.role })
  req.admin = admin
  req.adminPermissions = role?.permissions ?? []
  next()
}

export function requirePermission(permission: PermissionKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.adminPermissions?.includes(permission)) {
      res.status(403).json({ message: 'Forbidden' })
      return
    }
    next()
  }
}
