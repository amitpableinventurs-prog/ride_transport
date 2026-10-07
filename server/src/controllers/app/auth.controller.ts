import type { Request, Response } from 'express'
import { Customer } from '../../models/Customer'
import { Driver } from '../../models/Driver'
import { Device } from '../../models/Device'
import { RevokedToken } from '../../models/RevokedToken'
import {
  APP_USER_TYPES,
  signAppAccessToken,
  signAppRefreshToken,
  verifyAppRefreshToken,
  type AppUserType,
} from '../../utils/jwt'
import { issueOtp, OtpError, verifyOtp } from '../../utils/otp'
import { maskPhone, normalizeIndianMobile } from '../../utils/phone'
import { findAppUserById, findAppUserByPhone, isAppUserActive, serializeAppUser, type AppUser } from '../../utils/appUsers'

const INACTIVE_MESSAGE = 'This account has been suspended or blocked. Please contact support.'

function otpKey(userType: AppUserType, phone: string) {
  return `${userType}:${phone}`
}

function issueTokens(user: AppUser) {
  return {
    accessToken: signAppAccessToken(user.doc.id, user.type),
    refreshToken: signAppRefreshToken(user.doc.id, user.type),
    user: serializeAppUser(user),
  }
}

// SRS role names (/api/v1/auth) → account collections. A "rider" is a Driver record.
const ROLE_TO_USER_TYPE: Record<string, AppUserType> = { customer: 'customer', rider: 'driver' }

/** Validates { phone, userType } (or SRS { phone, role }) from the body; responds 400 and returns null when invalid. */
function readPhoneAndType(req: Request, res: Response): { phone: string; userType: AppUserType } | null {
  const { phone: rawPhone, role } = req.body as { phone?: unknown; role?: unknown }
  const userType = typeof role === 'string' ? ROLE_TO_USER_TYPE[role] : (req.body as { userType?: unknown }).userType
  if (role !== undefined && !userType) {
    res.status(400).json({ message: 'role must be one of: customer, rider' })
    return null
  }
  if (!APP_USER_TYPES.includes(userType as AppUserType)) {
    res.status(400).json({ message: `userType must be one of: ${APP_USER_TYPES.join(', ')}` })
    return null
  }
  const phone = normalizeIndianMobile(rawPhone)
  if (!phone) {
    res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number' })
    return null
  }
  return { phone, userType: userType as AppUserType }
}

function sendOtpError(res: Response, err: unknown) {
  if (err instanceof OtpError) {
    res.status(err.status).json({ message: err.message, ...err.details })
    return
  }
  throw err
}

// POST /otp/send
export async function sendOtp(req: Request, res: Response) {
  const input = readPhoneAndType(req, res)
  if (!input) return

  const existing = await findAppUserByPhone(input.userType, input.phone)
  if (existing && !isAppUserActive(existing)) {
    res.status(403).json({ message: INACTIVE_MESSAGE })
    return
  }

  try {
    const issued = await issueOtp('app_login', otpKey(input.userType, input.phone), input.phone)
    res.json({ message: 'OTP sent', phone: maskPhone(input.phone), ...issued })
  } catch (err) {
    sendOtpError(res, err)
  }
}

// POST /api/v1/auth/otp/verify (SRS): a new number gets an account straight away and
// isNewUser: true; the app then shows the Profile screen (profileComplete: false).
export async function verifyOtpAndSignIn(req: Request, res: Response) {
  const input = readPhoneAndType(req, res)
  if (!input) return
  if (input.userType === 'partner') {
    res.status(400).json({ message: 'role must be one of: customer, rider' })
    return
  }

  try {
    await verifyOtp('app_login', otpKey(input.userType, input.phone), (req.body as { otp?: unknown }).otp)
  } catch (err) {
    sendOtpError(res, err)
    return
  }

  const existing = await findAppUserByPhone(input.userType, input.phone)
  if (existing && !isAppUserActive(existing)) {
    res.status(403).json({ message: INACTIVE_MESSAGE })
    return
  }

  let user = existing
  if (!user) {
    // New riders start as approvalStatus "pending" until onboarding + document checks are done.
    user =
      input.userType === 'customer'
        ? { type: 'customer', doc: await Customer.create({ phone: input.phone }) }
        : { type: 'driver', doc: await Driver.create({ phone: input.phone }) }
  }

  res.status(existing ? 200 : 201).json({ isNewUser: !existing, ...issueTokens(user) })
}

async function revokeRefreshToken(jti: string | undefined, exp: number | undefined) {
  if (!jti || !exp) return
  await RevokedToken.updateOne({ jti }, { $setOnInsert: { jti, expiresAt: new Date(exp * 1000) } }, { upsert: true })
}

// POST /refresh: refresh tokens are single-use; each call returns a new pair.
export async function refresh(req: Request, res: Response) {
  const payload = verifyAppRefreshToken((req.body as { refreshToken?: unknown }).refreshToken)
  if (!payload || (payload.jti && (await RevokedToken.exists({ jti: payload.jti })))) {
    res.status(401).json({ message: 'Refresh token expired or invalid' })
    return
  }

  const user = await findAppUserById(payload.ut, payload.sub)
  if (!user || !isAppUserActive(user)) {
    res.status(401).json({ message: 'Account unavailable' })
    return
  }

  await revokeRefreshToken(payload.jti, payload.exp)
  res.json({
    accessToken: signAppAccessToken(user.doc.id, user.type),
    refreshToken: signAppRefreshToken(user.doc.id, user.type),
  })
}

// POST /logout: revokes the refresh token and unregisters the device's push token.
// The short-lived access token stays valid until it expires; the app discards it.
export async function logout(req: Request, res: Response) {
  const user = req.appUser!
  const { refreshToken, fcmToken } = (req.body ?? {}) as { refreshToken?: unknown; fcmToken?: unknown }

  const payload = verifyAppRefreshToken(refreshToken)
  if (payload && payload.sub === user.doc.id && payload.ut === user.type) await revokeRefreshToken(payload.jti, payload.exp)
  if (typeof fcmToken === 'string' && fcmToken) await Device.deleteOne({ token: fcmToken, userType: user.type, userId: user.doc._id })

  res.status(204).send()
}
