import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as authController from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
})

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP attempts. Please try again later.' },
})

router.post('/login', loginLimiter, authController.login)
router.post('/login/verify-otp', otpLimiter, authController.verifyLoginOtp)
router.post('/login/resend-otp', otpLimiter, authController.resendLoginOtp)
router.post('/refresh', authController.refresh)
router.post('/logout', requireAuth, authController.logout)
router.get('/me', requireAuth, authController.me)

export default router
