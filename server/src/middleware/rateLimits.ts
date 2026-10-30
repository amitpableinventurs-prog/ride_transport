import rateLimit from 'express-rate-limit'

export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please try again later.' },
})

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
})

// App error reports: one failure can cause a few at once, but a device stuck in a crash loop must not flood the logs.
export const errorReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many error reports. Please try again later.' },
})
