import crypto from 'crypto'
import { env } from '../config/env'
import { OtpCode } from '../models/OtpCode'
import { Settings } from '../models/Settings'
import { NotificationTemplate } from '../models/NotificationTemplate'
import { getSmsProvider } from './sms'

export type OtpPurpose = 'admin_login' | 'app_login'

const DEFAULT_TEMPLATE = 'Your AnZ Cabs OTP is {{otp}}. Valid for {{expiry_minutes}} minutes. Do not share it with anyone.'
const HOUR_MS = 60 * 60 * 1000

export class OtpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

export interface IssuedOtp {
  expiresInSeconds: number
  resendAfterSeconds: number
  /** Only present when OTP_DEV_ECHO is on (never in production). */
  devOtp?: string
}

function hashCode(key: string, code: string): string {
  return crypto.createHmac('sha256', env.otpSecret).update(`${key}:${code}`).digest('hex')
}

function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

async function otpExpiryMinutes(): Promise<number> {
  const settings = await Settings.findOne({ singleton: 'platform' }).select('otpExpiryMinutes')
  const minutes = settings?.otpExpiryMinutes ?? 5
  return minutes > 0 ? minutes : 5
}

async function renderMessage(code: string, expiryMinutes: number): Promise<string> {
  // Admins can edit the wording from Marketing → Notifications (template key "otp_sms").
  const template = await NotificationTemplate.findOne({ key: 'otp_sms', status: 'active' }).select('body')
  const body = template?.body || DEFAULT_TEMPLATE
  return body.replaceAll('{{otp}}', code).replaceAll('{{expiry_minutes}}', String(expiryMinutes))
}

/**
 * Creates (or replaces) the OTP for `key` and sends it by SMS.
 * Enforces a resend cooldown and a maximum number of sends per hour.
 */
export async function issueOtp(purpose: OtpPurpose, key: string, destination: string): Promise<IssuedOtp> {
  const now = new Date()
  const existing = await OtpCode.findOne({ purpose, key })

  let sendCount = 1
  let windowStartedAt = now
  if (existing) {
    const secondsSinceLastSend = (now.getTime() - existing.lastSentAt.getTime()) / 1000
    if (secondsSinceLastSend < env.otpResendCooldownSeconds) {
      const retryAfterSeconds = Math.ceil(env.otpResendCooldownSeconds - secondsSinceLastSend)
      throw new OtpError(429, `Please wait ${retryAfterSeconds}s before requesting another OTP.`, { retryAfterSeconds })
    }

    const windowActive = now.getTime() - existing.windowStartedAt.getTime() < HOUR_MS
    if (windowActive) {
      if (existing.sendCount >= env.otpMaxSendsPerHour) {
        const retryAfterSeconds = Math.ceil((existing.windowStartedAt.getTime() + HOUR_MS - now.getTime()) / 1000)
        throw new OtpError(429, 'Too many OTP requests. Please try again later.', { retryAfterSeconds })
      }
      sendCount = existing.sendCount + 1
      windowStartedAt = existing.windowStartedAt
    }
  }

  const code = generateCode()
  const expiryMinutes = await otpExpiryMinutes()
  const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000)

  await OtpCode.findOneAndUpdate(
    { purpose, key },
    {
      purpose,
      key,
      channel: 'sms',
      destination,
      codeHash: hashCode(key, code),
      expiresAt,
      attempts: 0,
      sendCount,
      windowStartedAt,
      lastSentAt: now,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  await getSmsProvider().send(destination, await renderMessage(code, expiryMinutes))

  return {
    expiresInSeconds: expiryMinutes * 60,
    resendAfterSeconds: env.otpResendCooldownSeconds,
    ...(env.otpDevEcho ? { devOtp: code } : {}),
  }
}

/** Checks the code and consumes it on success. Throws OtpError otherwise. */
export async function verifyOtp(purpose: OtpPurpose, key: string, code: unknown): Promise<void> {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    throw new OtpError(400, 'Enter the 6-digit OTP.')
  }

  const otp = await OtpCode.findOne({ purpose, key })
  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    throw new OtpError(400, 'OTP has expired. Please request a new one.')
  }
  if (otp.attempts >= env.otpMaxAttempts) {
    throw new OtpError(429, 'Too many incorrect attempts. Please request a new OTP.')
  }

  const expected = Buffer.from(otp.codeHash, 'hex')
  const actual = Buffer.from(hashCode(key, code), 'hex')
  if (!crypto.timingSafeEqual(expected, actual)) {
    otp.attempts += 1
    await otp.save()
    const attemptsLeft = Math.max(0, env.otpMaxAttempts - otp.attempts)
    throw new OtpError(400, attemptsLeft > 0 ? 'Incorrect OTP.' : 'Too many incorrect attempts. Please request a new OTP.', {
      attemptsLeft,
    })
  }

  // Consume the code but keep the doc so the hourly send limit still applies.
  otp.expiresAt = new Date(0)
  await otp.save()
}
