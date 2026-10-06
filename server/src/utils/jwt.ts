import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface AccessTokenPayload {
  sub: string
  type: 'access'
}

export interface RefreshTokenPayload {
  sub: string
  type: 'refresh'
}

export function signAccessToken(adminId: string, ttlMinutes = env.accessTokenTtlMinutes): string {
  return jwt.sign({ sub: adminId, type: 'access' } satisfies AccessTokenPayload, env.jwtAccessSecret, {
    expiresIn: `${ttlMinutes}m`,
  })
}

export function signRefreshToken(adminId: string, ttlDays = env.refreshTokenTtlDays): string {
  return jwt.sign({ sub: adminId, type: 'refresh' } satisfies RefreshTokenPayload, env.jwtRefreshSecret, {
    expiresIn: `${ttlDays}d`,
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload
    return payload.type === 'access' ? payload : null
  } catch {
    return null
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const payload = jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload
    return payload.type === 'refresh' ? payload : null
  } catch {
    return null
  }
}

// ---- Admin login OTP challenge ----
// Issued after a correct password when OTP is enabled; exchanged for real tokens
// once the OTP is verified. It cannot be used as an access token (different type).

export interface OtpChallengePayload {
  sub: string
  type: 'admin_otp'
}

const OTP_CHALLENGE_TTL_MINUTES = 10

export function signOtpChallengeToken(adminId: string): string {
  return jwt.sign({ sub: adminId, type: 'admin_otp' } satisfies OtpChallengePayload, env.jwtAccessSecret, {
    expiresIn: `${OTP_CHALLENGE_TTL_MINUTES}m`,
  })
}

export function verifyOtpChallengeToken(token: unknown): OtpChallengePayload | null {
  if (typeof token !== 'string') return null
  try {
    const payload = jwt.verify(token, env.jwtAccessSecret) as OtpChallengePayload
    return payload.type === 'admin_otp' ? payload : null
  } catch {
    return null
  }
}

// ---- Mobile app (customer / driver / partner) ----

export type AppUserType = 'customer' | 'driver' | 'partner'
export const APP_USER_TYPES: readonly AppUserType[] = ['customer', 'driver', 'partner']

export interface AppTokenPayload {
  sub: string
  ut: AppUserType
  type: 'app_access' | 'app_refresh'
}

export interface AppRegistrationPayload {
  phone: string
  ut: AppUserType
  type: 'app_registration'
}

export function signAppAccessToken(userId: string, userType: AppUserType): string {
  return jwt.sign({ sub: userId, ut: userType, type: 'app_access' } satisfies AppTokenPayload, env.jwtAppAccessSecret, {
    expiresIn: `${env.appAccessTokenTtlMinutes}m`,
  })
}

export function signAppRefreshToken(userId: string, userType: AppUserType): string {
  return jwt.sign({ sub: userId, ut: userType, type: 'app_refresh' } satisfies AppTokenPayload, env.jwtAppRefreshSecret, {
    expiresIn: `${env.appRefreshTokenTtlDays}d`,
  })
}

export function verifyAppAccessToken(token: string): AppTokenPayload | null {
  try {
    const payload = jwt.verify(token, env.jwtAppAccessSecret) as AppTokenPayload
    return payload.type === 'app_access' ? payload : null
  } catch {
    return null
  }
}

export function verifyAppRefreshToken(token: unknown): AppTokenPayload | null {
  if (typeof token !== 'string') return null
  try {
    const payload = jwt.verify(token, env.jwtAppRefreshSecret) as AppTokenPayload
    return payload.type === 'app_refresh' ? payload : null
  } catch {
    return null
  }
}

// Proves the phone number was verified by OTP; lets a new user finish sign-up.
const REGISTRATION_TTL_MINUTES = 30

export function signAppRegistrationToken(phone: string, userType: AppUserType): string {
  return jwt.sign({ phone, ut: userType, type: 'app_registration' } satisfies AppRegistrationPayload, env.jwtAppAccessSecret, {
    expiresIn: `${REGISTRATION_TTL_MINUTES}m`,
  })
}

export function verifyAppRegistrationToken(token: unknown): AppRegistrationPayload | null {
  if (typeof token !== 'string') return null
  try {
    const payload = jwt.verify(token, env.jwtAppAccessSecret) as AppRegistrationPayload
    return payload.type === 'app_registration' ? payload : null
  } catch {
    return null
  }
}
