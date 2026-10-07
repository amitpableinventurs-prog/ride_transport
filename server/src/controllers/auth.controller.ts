import type { Request, Response } from 'express'
import { Admin } from '../models/Admin'
import { Role } from '../models/Role'
import { Settings } from '../models/Settings'
import { comparePassword } from '../utils/password'
import {
  signAccessToken,
  signOtpChallengeToken,
  signRefreshToken,
  newSessionId,
  verifyOtpChallengeToken,
  verifyRefreshToken,
} from '../utils/jwt'
import { claimRefreshToken, isSessionRevoked, revokeSession } from '../utils/sessions'
import { recordAudit } from '../utils/audit'
import { roleDisplayName } from '../utils/roles'
import { issueOtp, OtpError, verifyOtp } from '../utils/otp'
import { maskPhone } from '../utils/phone'
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

function sendOtpError(res: Response, err: unknown) {
  if (err instanceof OtpError) {
    res.status(err.status).json({ message: err.message, ...err.details })
    return
  }
  throw err
}

async function loadChallengeAdmin(otpToken: unknown, res: Response) {
  const payload = verifyOtpChallengeToken(otpToken)
  if (!payload) {
    res.status(401).json({ message: 'Your sign-in session expired. Please sign in again.' })
    return null
  }
  const admin = await Admin.findById(payload.sub)
  if (!admin || admin.status === 'suspended') {
    res.status(401).json({ message: 'Account unavailable' })
    return null
  }
  return admin
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

  const settings = await Settings.findOne({ singleton: 'platform' }).select('adminLoginOtpEnabled')
  if (settings?.adminLoginOtpEnabled === false) {
    await completeLogin(admin, res)
    return
  }

  try {
    const issued = await issueOtp('admin_login', admin.id, admin.phone)
    res.json({
      otpRequired: true,
      otpToken: signOtpChallengeToken(admin.id),
      maskedPhone: maskPhone(admin.phone),
      ...issued,
    })
  } catch (err) {
    sendOtpError(res, err)
  }
}

export async function verifyLoginOtp(req: Request, res: Response) {
  const { otpToken, otp } = req.body as { otpToken?: string; otp?: string }
  const admin = await loadChallengeAdmin(otpToken, res)
  if (!admin) return

  try {
    await verifyOtp('admin_login', admin.id, otp)
  } catch (err) {
    sendOtpError(res, err)
    return
  }
  await completeLogin(admin, res)
}

export async function resendLoginOtp(req: Request, res: Response) {
  const { otpToken } = req.body as { otpToken?: string }
  const admin = await loadChallengeAdmin(otpToken, res)
  if (!admin) return

  try {
    const issued = await issueOtp('admin_login', admin.id, admin.phone)
    res.json({ maskedPhone: maskPhone(admin.phone), ...issued })
  } catch (err) {
    sendOtpError(res, err)
  }
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
