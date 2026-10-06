import type { PermissionKey, RoleKey } from './rbac'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: RoleKey
  roleName: string
  permissions: PermissionKey[]
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export interface OtpChallenge {
  otpToken: string
  maskedPhone: string
  expiresInSeconds: number
  resendAfterSeconds: number
  /** Only returned by a development backend (OTP_DEV_ECHO). */
  devOtp?: string
}

export type LoginResult = LoginResponse | ({ otpRequired: true } & OtpChallenge)
