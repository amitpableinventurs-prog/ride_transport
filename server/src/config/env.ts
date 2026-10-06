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

export const env = {
  port: Number(process.env.PORT ?? 5000),
  mongoUri: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/rideflow_admin'),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
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

  isProduction,
}
