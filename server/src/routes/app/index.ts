import { Router } from 'express'
import * as appAuthController from '../../controllers/app/auth.controller'
import * as appProfileController from '../../controllers/app/profile.controller'
import { rejectDuringMaintenance, requireAppAuth } from '../../middleware/appAuth'
import { otpSendLimiter, otpVerifyLimiter } from '../../middleware/rateLimits'

// APIs for the Flutter customer / rider-driver / partner apps, mounted at /api/v1/app.
const router = Router()

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
