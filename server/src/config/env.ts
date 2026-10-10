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
  // Requests per IP per 15 minutes across the whole API (login and OTP routes have stricter limits of their own).
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 5000),
  // Signed-in app users are limited per account (requests per minute), not per IP: phones share carrier IPs.
  appUserRateLimit: Number(process.env.APP_USER_RATE_LIMIT ?? 240),
  // Load protection: answer 503 instead of queueing when the server is falling behind.
  maxEventLoopLagMs: Number(process.env.MAX_EVENT_LOOP_LAG_MS ?? 250),
  maxConcurrentRequests: Number(process.env.MAX_CONCURRENT_REQUESTS ?? 250),
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 30000),
  // Set LOG_REQUESTS=false to switch off the per-request access log (busy servers can log to a file or proxy instead).
  logRequests: (process.env.LOG_REQUESTS ?? 'true') !== 'false',
  // MongoDB connection pool size.
  dbPoolSize: Number(process.env.DB_POOL_SIZE ?? 50),
  // Number of reverse proxies in front of the server (0 = none). Needed so rate limits see the real client IP.
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  // Twilio (SMS_PROVIDER=twilio): the Account SID plus either the Auth Token, or an API Key SID + Secret,
  // and a sender: a Twilio phone number (TWILIO_FROM) or a Messaging Service SID.
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioApiKeySid: process.env.TWILIO_API_KEY_SID ?? '',
  twilioApiKeySecret: process.env.TWILIO_API_KEY_SECRET ?? '',
  twilioFrom: process.env.TWILIO_FROM ?? '',
  twilioMessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID ?? '',

  // Payments: "mock" (development) or "razorpay".
  paymentProvider: process.env.PAYMENT_PROVIDER ?? 'mock',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
  // Push notifications: "console" prints them, "fcm" sends through Firebase (src/utils/fcm.ts).
  pushProvider: process.env.PUSH_PROVIDER ?? 'console',
  // The customer and rider apps are separate Firebase projects: one service account key each,
  // as a path to the JSON file or the JSON itself.
  fcmCustomerServiceAccount: process.env.FIREBASE_CUSTOMER_SERVICE_ACCOUNT ?? '',
  fcmRiderServiceAccount: process.env.FIREBASE_RIDER_SERVICE_ACCOUNT ?? '',
  // Masked calling: "direct" returns the real number (development only). Add Exotel etc. in src/utils/telephony.ts.
  telephonyProvider: process.env.TELEPHONY_PROVIDER ?? 'direct',
  // Rider app store link for the customer app's "Earn money with anzcabs" banner.
  riderAppUrl: process.env.RIDER_APP_URL ?? '',

  isProduction,
}

// Refuse to start in production with development defaults: guessable secrets would let anyone sign tokens.
if (isProduction) {
  const weak = (name: string, value: string) => !process.env[name] || value.length < 32 || /change-me|dev-/i.test(value)
  const problems = [
    weak('JWT_ACCESS_SECRET', jwtAccessSecret) && 'JWT_ACCESS_SECRET',
    weak('JWT_REFRESH_SECRET', jwtRefreshSecret) && 'JWT_REFRESH_SECRET',
    jwtAccessSecret === jwtRefreshSecret && 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ',
    (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') && 'CORS_ORIGIN (set the admin panel origin)',
  ].filter(Boolean)
  if (problems.length) throw new Error(`Unsafe production configuration, fix: ${problems.join(', ')}`)
}
