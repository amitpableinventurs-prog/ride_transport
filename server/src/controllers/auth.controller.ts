import type { Request, Response } from 'express'
import { Admin } from '../models/Admin'
import { Role } from '../models/Role'
import { comparePassword } from '../utils/password'
import {
  signAccessToken,
  signRefreshToken,
  newSessionId,
  verifyRefreshToken,
} from '../utils/jwt'
import { claimRefreshToken, isSessionRevoked, revokeSession } from '../utils/sessions'
import { recordAudit } from '../utils/audit'
import { roleDisplayName } from '../utils/roles'
import type { HydratedDocument } from 'mongoose'
import type { AdminDocument } from '../models/Admin'

async function toAuthUser(admin: HydratedDocument<AdminDocument>) {
  const role = await Role.findOne({ key: admin.role })
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    roleName: role?.name ?? roleDisplayName(admin.role),
    permissions: role?.permissions ?? [],
  }
}

async function completeLogin(admin: HydratedDocument<AdminDocument>, res: Response) {
  const fid = newSessionId()
  const accessToken = signAccessToken(admin.id, fid)
  const refreshToken = signRefreshToken(admin.id, fid)

  admin.lastLoginAt = new Date()
  await admin.save()
  await recordAudit(admin, 'auth.login', 'Session', admin.email)

  res.json({ accessToken, refreshToken, user: await toAuthUser(admin) })
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string }
  if (!email || !password) {
    res.status(400).json({ message: 'Email and password are required' })
    return
  }

  const admin = await Admin.findOne({ email: email.trim().toLowerCase() })
  if (!admin || !(await comparePassword(password, admin.passwordHash))) {
    res.status(401).json({ message: 'Invalid email or password' })
    return
  }
  if (admin.status === 'suspended') {
    res.status(403).json({ message: 'This account has been suspended. Contact a Super Admin.' })
    return
  }

  await completeLogin(admin, res)
}

export async function refresh(req: Request, res: Response) {
  const { refreshToken } = req.body as { refreshToken?: string }
  const payload = verifyRefreshToken(refreshToken)
  if (!payload || (await isSessionRevoked(payload.fid))) {
    res.status(401).json({ message: 'Refresh token expired or invalid' })
    return
  }
  // Single use: a token that was already exchanged is being replayed, so end the whole session.
  if (!(await claimRefreshToken(payload.jti, payload.exp))) {
    await revokeSession(payload.fid)
    res.status(401).json({ message: 'Your session is no longer valid. Please sign in again.' })
    return
  }

  const admin = await Admin.findById(payload.sub)
  if (!admin || admin.status === 'suspended') {
    res.status(401).json({ message: 'Account unavailable' })
    return
  }

  res.json({
    accessToken: signAccessToken(admin.id, payload.fid),
    refreshToken: signRefreshToken(admin.id, payload.fid),
  })
}

export async function logout(req: Request, res: Response) {
  // Ends the whole login session, so the access token stops working immediately too.
  await revokeSession(req.adminSessionId)
  if (req.admin) {
    await recordAudit(req.admin, 'auth.logout', 'Session', req.admin.email)
  }
  res.status(204).send()
}

export async function me(req: Request, res: Response) {
  if (!req.admin) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }
  res.json(await toAuthUser(req.admin))
}
