import type { Request, Response } from 'express'
import { Customer } from '../../models/Customer'
import { Driver } from '../../models/Driver'
import { TransportPartner } from '../../models/TransportPartner'
import { Device } from '../../models/Device'
import {
  APP_USER_TYPES,
  signAppAccessToken,
  signAppRefreshToken,
  newSessionId,
  signAppRegistrationToken,
  verifyAppRefreshToken,
  verifyAppRegistrationToken,
  type AppUserType,
} from '../../utils/jwt'
import { issueOtp, OtpError, verifyOtp } from '../../utils/otp'
import { claimRefreshToken, isSessionRevoked, revokeSession } from '../../utils/sessions'
import { maskPhone, normalizeIndianMobile } from '../../utils/phone'
import { DRIVER_MIN_AGE, parseProfileInput } from '../../utils/profileInput'
import { findAppUserById, findAppUserByPhone, isAppUserActive, serializeAppUser, type AppUser } from '../../utils/appUsers'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INACTIVE_MESSAGE = 'This account has been suspended or blocked. Please contact support.'

function otpKey(userType: AppUserType, phone: string) {
  return `${userType}:${phone}`
}

function issueTokens(user: AppUser) {
  const fid = newSessionId()
  return {
    accessToken: signAppAccessToken(user.doc.id, user.type, fid),
    refreshToken: signAppRefreshToken(user.doc.id, user.type, fid),
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

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

// POST /otp/send and /otp/resend
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

// POST /otp/verify
export async function verifyOtpAndLogin(req: Request, res: Response) {
  const input = readPhoneAndType(req, res)
  if (!input) return

  try {
    await verifyOtp('app_login', otpKey(input.userType, input.phone), (req.body as { otp?: unknown }).otp)
  } catch (err) {
    sendOtpError(res, err)
    return
  }

  const user = await findAppUserByPhone(input.userType, input.phone)
  if (!user) {
    res.json({ isNewUser: true, registrationToken: signAppRegistrationToken(input.phone, input.userType) })
    return
  }
  if (!isAppUserActive(user)) {
    res.status(403).json({ message: INACTIVE_MESSAGE })
    return
  }

  res.json({ isNewUser: false, ...issueTokens(user) })
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

// POST /register
export async function register(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  const registration = verifyAppRegistrationToken(body.registrationToken)
  if (!registration) {
    res.status(401).json({ message: 'Registration session expired. Verify your phone number again.' })
    return
  }

  const { phone, ut: userType } = registration
  if (await findAppUserByPhone(userType, phone)) {
    res.status(409).json({ message: 'This phone number is already registered. Please log in.' })
    return
  }

  let user: AppUser
  if (userType === 'customer' || userType === 'driver') {
    // Fields from the app's Profile screen; name and emergency contact are required.
    const parsed = parseProfileInput(body, { ownPhone: phone, partial: false, minAge: userType === 'driver' ? DRIVER_MIN_AGE : undefined })
    if (!parsed.ok) {
      res.status(400).json({ message: parsed.message })
      return
    }
    const { email, gender, dateOfBirth, ...profile } = parsed.value
    const personal = { ...profile, phone, email: email ?? undefined, gender: gender ?? undefined, dateOfBirth: dateOfBirth ?? undefined }

    if (userType === 'customer') {
      const doc = await Customer.create({ ...personal, city: optionalString(body.city) })
      user = { type: 'customer', doc }
    } else {
      const serviceType = body.serviceType
      if (serviceType !== 'rider' && serviceType !== 'driver') {
        res.status(400).json({ message: 'serviceType (rider or driver) is required' })
        return
      }
      // New riders/drivers start as approvalStatus "pending" until an admin verifies their documents.
      const doc = await Driver.create({ ...personal, serviceType })
      user = { type: 'driver', doc }
    }
  } else {
    const companyName = optionalString(body.companyName)
    const ownerName = optionalString(body.ownerName)
    if (!companyName || !ownerName) {
      res.status(400).json({ message: 'companyName and ownerName are required' })
      return
    }
    const email = optionalString(body.email)?.toLowerCase()
    if (email && !EMAIL_RE.test(email)) {
      res.status(400).json({ message: 'Enter a valid email address' })
      return
    }
    const doc = await TransportPartner.create({
      companyName,
      ownerName,
      email,
      phone,
      businessRegNo: optionalString(body.businessRegNo),
      taxId: optionalString(body.taxId),
    })
    user = { type: 'partner', doc }
  }

  res.status(201).json(issueTokens(user))
}

// POST /refresh: refresh tokens are single-use; each call returns a new pair.
export async function refresh(req: Request, res: Response) {
  const payload = verifyAppRefreshToken((req.body as { refreshToken?: unknown }).refreshToken)
  if (!payload || (await isSessionRevoked(payload.fid))) {
    res.status(401).json({ message: 'Refresh token expired or invalid' })
    return
  }
  // Single use: a token that was already exchanged is being replayed, so end the whole session.
  if (!(await claimRefreshToken(payload.jti, payload.exp))) {
    await revokeSession(payload.fid)
    res.status(401).json({ message: 'Your session is no longer valid. Please log in again.' })
    return
  }

  const user = await findAppUserById(payload.ut, payload.sub)
  if (!user || !isAppUserActive(user)) {
    res.status(401).json({ message: 'Account unavailable' })
    return
  }

  res.json({
    accessToken: signAppAccessToken(user.doc.id, user.type, payload.fid),
    refreshToken: signAppRefreshToken(user.doc.id, user.type, payload.fid),
  })
}

// GET /me
export async function me(req: Request, res: Response) {
  res.json(serializeAppUser(req.appUser!))
}

// POST /logout: revokes the refresh token and unregisters the device's push token.
export async function logout(req: Request, res: Response) {
  const user = req.appUser!
  const { refreshToken, fcmToken } = (req.body ?? {}) as { refreshToken?: unknown; fcmToken?: unknown }

  // Ends the whole login session, so the access token stops working immediately too.
  const payload = verifyAppRefreshToken(refreshToken)
  if (payload && payload.sub === user.doc.id && payload.ut === user.type) await revokeSession(payload.fid)
  else await revokeSession(req.appSessionId)
  if (typeof fcmToken === 'string' && fcmToken) await Device.deleteOne({ token: fcmToken, userType: user.type, userId: user.doc._id })

  res.status(204).send()
}
