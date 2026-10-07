import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

// Every token is HS256, carries an issuer, an audience for its purpose, a unique id (jti) and, for sessions,
// a family id (fid). The audience stops a token made for one purpose from being accepted for another even if
// two purposes share a secret; the fid lets a whole login session be revoked at once (logout, refresh-token reuse).

const ISSUER = 'anzcabs-api'
const ALGORITHM = 'HS256' as const

export const AUDIENCE = {
  adminAccess: 'admin:access',
  adminRefresh: 'admin:refresh',
  adminOtp: 'admin:otp-challenge',
  appAccess: 'app:access',
  appRefresh: 'app:refresh',
  appRegistration: 'app:registration',
  invoice: 'public:invoice',
} as const
type Audience = (typeof AUDIENCE)[keyof typeof AUDIENCE]

function sign(payload: Record<string, unknown>, secret: string, audience: Audience, expiresIn: string): string {
  return jwt.sign(payload, secret, { algorithm: ALGORITHM, issuer: ISSUER, audience, expiresIn, jwtid: crypto.randomUUID() } as jwt.SignOptions)
}

function verify<T extends { type?: string }>(token: unknown, secret: string, audience: Audience, type: string): (T & { jti?: string; exp?: number }) | null {
  if (typeof token !== 'string' || !token || token.length > 4000) return null
  try {
    const payload = jwt.verify(token, secret, { algorithms: [ALGORITHM], issuer: ISSUER, audience }) as T & { jti?: string; exp?: number }
    return payload.type === type ? payload : null
  } catch {
    return null
  }
}

export const newSessionId = () => crypto.randomUUID()

// ---- Admin panel ----

export interface AccessTokenPayload {
  sub: string
  fid: string
  type: 'access'
  jti?: string
  exp?: number
}

export interface RefreshTokenPayload {
  sub: string
  fid: string
  type: 'refresh'
  jti?: string
  exp?: number
}

export function signAccessToken(adminId: string, fid: string, ttlMinutes = env.accessTokenTtlMinutes): string {
  return sign({ sub: adminId, fid, type: 'access' } satisfies AccessTokenPayload, env.jwtAccessSecret, AUDIENCE.adminAccess, `${ttlMinutes}m`)
}

export function signRefreshToken(adminId: string, fid: string, ttlDays = env.refreshTokenTtlDays): string {
  return sign({ sub: adminId, fid, type: 'refresh' } satisfies RefreshTokenPayload, env.jwtRefreshSecret, AUDIENCE.adminRefresh, `${ttlDays}d`)
}

export function verifyAccessToken(token: unknown): AccessTokenPayload | null {
  return verify<AccessTokenPayload>(token, env.jwtAccessSecret, AUDIENCE.adminAccess, 'access')
}

export function verifyRefreshToken(token: unknown): RefreshTokenPayload | null {
  return verify<RefreshTokenPayload>(token, env.jwtRefreshSecret, AUDIENCE.adminRefresh, 'refresh')
}

// ---- Admin login OTP challenge ----
// Issued after a correct password when OTP is enabled; exchanged for real tokens
// once the OTP is verified. It cannot be used as an access token (different audience and type).

export interface OtpChallengePayload {
  sub: string
  type: 'admin_otp'
}

const OTP_CHALLENGE_TTL_MINUTES = 10

export function signOtpChallengeToken(adminId: string): string {
  return sign({ sub: adminId, type: 'admin_otp' } satisfies OtpChallengePayload, env.jwtAccessSecret, AUDIENCE.adminOtp, `${OTP_CHALLENGE_TTL_MINUTES}m`)
}

export function verifyOtpChallengeToken(token: unknown): OtpChallengePayload | null {
  return verify<OtpChallengePayload>(token, env.jwtAccessSecret, AUDIENCE.adminOtp, 'admin_otp')
}

// ---- Mobile app (customer / driver / partner) ----

export type AppUserType = 'customer' | 'driver' | 'partner'
export const APP_USER_TYPES: readonly AppUserType[] = ['customer', 'driver', 'partner']

export interface AppTokenPayload {
  sub: string
  ut: AppUserType
  fid: string
  type: 'app_access' | 'app_refresh'
  jti?: string
  exp?: number
}

export interface AppRegistrationPayload {
  phone: string
  ut: AppUserType
  type: 'app_registration'
}

export function signAppAccessToken(userId: string, userType: AppUserType, fid: string): string {
  return sign({ sub: userId, ut: userType, fid, type: 'app_access' } satisfies AppTokenPayload, env.jwtAppAccessSecret, AUDIENCE.appAccess, `${env.appAccessTokenTtlMinutes}m`)
}

export function signAppRefreshToken(userId: string, userType: AppUserType, fid: string): string {
  return sign({ sub: userId, ut: userType, fid, type: 'app_refresh' } satisfies AppTokenPayload, env.jwtAppRefreshSecret, AUDIENCE.appRefresh, `${env.appRefreshTokenTtlDays}d`)
}

export function verifyAppAccessToken(token: unknown): AppTokenPayload | null {
  const payload = verify<AppTokenPayload>(token, env.jwtAppAccessSecret, AUDIENCE.appAccess, 'app_access')
  return payload && APP_USER_TYPES.includes(payload.ut) ? payload : null
}

export function verifyAppRefreshToken(token: unknown): AppTokenPayload | null {
  const payload = verify<AppTokenPayload>(token, env.jwtAppRefreshSecret, AUDIENCE.appRefresh, 'app_refresh')
  return payload && APP_USER_TYPES.includes(payload.ut) ? payload : null
}

// Proves the phone number was verified by OTP; lets a new user finish sign-up.
const REGISTRATION_TTL_MINUTES = 30

export function signAppRegistrationToken(phone: string, userType: AppUserType): string {
  return sign({ phone, ut: userType, type: 'app_registration' } satisfies AppRegistrationPayload, env.jwtAppAccessSecret, AUDIENCE.appRegistration, `${REGISTRATION_TTL_MINUTES}m`)
}

export function verifyAppRegistrationToken(token: unknown): AppRegistrationPayload | null {
  const payload = verify<AppRegistrationPayload>(token, env.jwtAppAccessSecret, AUDIENCE.appRegistration, 'app_registration')
  return payload && APP_USER_TYPES.includes(payload.ut) ? payload : null
}

// ---- Public invoice links ----
// The invoice URL is opened outside the app (browser / share sheet), so it carries its own short-lived token.

const INVOICE_TTL_DAYS = 7

export function signInvoiceToken(bookingId: string): string {
  return sign({ bid: bookingId, type: 'invoice' }, env.jwtAppAccessSecret, AUDIENCE.invoice, `${INVOICE_TTL_DAYS}d`)
}

export function verifyInvoiceToken(token: string): string | null {
  const payload = verify<{ bid?: string; type: string }>(token, env.jwtAppAccessSecret, AUDIENCE.invoice, 'invoice')
  return payload?.bid ? payload.bid : null
}
