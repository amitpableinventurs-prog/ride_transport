import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const isProduction = process.env.NODE_ENV === 'production'
const jwtAccessSecret = required('JWT_ACCESS_SECRET', 'dev-access-secret-change-me')
const jwtRefreshSecret = required('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me')

const port = Number(process.env.PORT ?? 5000)

export const env = {
  port,
  // Base URL the apps use to reach this server; used in share-tracking and invoice links.
  publicBaseUrl: (process.env.PUBLIC_BASE_URL ?? `http://localhost:${port}`).replace(/\/$/, ''),
  // Uploaded documents, selfies and delivery photos (served at /uploads).
  uploadDir: process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads'),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/rideflow_admin'),
  // In development any localhost port is allowed, since Vite moves to the next free port when 5173 is taken.
  corsOrigin: isProduction
    ? (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    : [process.env.CORS_ORIGIN ?? 'http://localhost:5173', /^http:\/\/(localhost|127\.0\.0\.1):\d+$/],
  jwtAccessSecret,
  jwtRefreshSecret,
  // Mobile-app tokens use their own secrets so they can never pass admin auth.
  jwtAppAccessSecret: process.env.JWT_APP_ACCESS_SECRET ?? `${jwtAccessSecret}:app`,
  jwtAppRefreshSecret: process.env.JWT_APP_REFRESH_SECRET ?? `${jwtRefreshSecret}:app`,
  accessTokenTtlMinutes: Number(process.env.ACCESS_TOKEN_TTL_MINUTES ?? 15),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  appAccessTokenTtlMinutes: Number(process.env.APP_ACCESS_TOKEN_TTL_MINUTES ?? 60),
  appRefreshTokenTtlDays: Number(process.env.APP_REFRESH_TOKEN_TTL_DAYS ?? 30),
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123',

  // OTP
  otpSecret: process.env.OTP_SECRET ?? `${jwtAccessSecret}:otp`,
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 30),
  otpMaxSendsPerHour: Number(process.env.OTP_MAX_SENDS_PER_HOUR ?? 5),
  // Returns the code in API responses so it can be tested without an SMS provider.
  // Never enabled in production.
  otpDevEcho: !isProduction && (process.env.OTP_DEV_ECHO ?? 'true') === 'true',
  smsProvider: process.env.SMS_PROVIDER ?? 'console',

  // Payments: "mock" (development) or "razorpay".
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  // Push notifications: "console" prints them. Add FCM in src/utils/push.ts.
  pushProvider: process.env.PUSH_PROVIDER ?? 'console',
  // Masked calling: "direct" returns the real number (development only). Add Exotel etc. in src/utils/telephony.ts.
  telephonyProvider: process.env.TELEPHONY_PROVIDER ?? 'direct',

  isProduction,
}
