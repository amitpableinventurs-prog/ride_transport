import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as appAuthController from '../../controllers/app/auth.controller'
import * as appProfileController from '../../controllers/app/profile.controller'
import { rejectDuringMaintenance, requireAppAuth } from '../../middleware/appAuth'

// APIs for the Flutter customer / rider-driver / partner apps, mounted at /api/v1/app.
const router = Router()

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many OTP requests. Please try again later.' },
})

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
})

router.use(rejectDuringMaintenance)

router.post('/auth/otp/send', otpSendLimiter, appAuthController.sendOtp)
router.post('/auth/otp/resend', otpSendLimiter, appAuthController.sendOtp)
router.post('/auth/otp/verify', otpVerifyLimiter, appAuthController.verifyOtpAndLogin)
router.post('/auth/register', otpVerifyLimiter, appAuthController.register)
router.post('/auth/refresh', appAuthController.refresh)
router.get('/auth/me', requireAppAuth, appAuthController.me)
router.post('/auth/logout', requireAppAuth, appAuthController.logout)

router.get('/profile', requireAppAuth, appProfileController.getProfile)
router.patch('/profile', requireAppAuth, appProfileController.updateProfile)

export default router
