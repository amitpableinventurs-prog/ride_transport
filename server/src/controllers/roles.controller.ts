import type { Request, Response } from 'express'
import { Role } from '../models/Role'
import { recordAudit } from '../utils/audit'
import type { PermissionKey, RoleKey } from '../types/rbac'

export async function listRoles(_req: Request, res: Response) {
  const roles = await Role.find().sort({ createdAt: 1 })
  res.json(roles)
}

export async function updateRolePermissions(req: Request, res: Response) {
  const key = req.params.key as RoleKey
  const { permissions } = req.body as { permissions?: PermissionKey[] }
  if (!Array.isArray(permissions)) {
    res.status(400).json({ message: 'permissions must be an array' })
    return
  }

  const role = await Role.findOneAndUpdate({ key }, { permissions }, { new: true })
  if (!role) {
    res.status(404).json({ message: 'Role not found' })
    return
  }

  await recordAudit(req.admin!, 'role.permissions_updated', 'Role', role.name, { permissionCount: permissions.length })

  res.json(role)
}
