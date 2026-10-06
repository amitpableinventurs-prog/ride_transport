import { Router } from 'express'
import * as appAuthController from '../../controllers/app/auth.controller'
import { rejectDuringMaintenance, requireAppAuth } from '../../middleware/appAuth'
import { otpSendLimiter, otpVerifyLimiter } from '../../middleware/rateLimits'

// SRS §10.1, mounted at /api/v1/auth. `role` is customer or rider.
const router = Router()

router.use(rejectDuringMaintenance)

router.post('/otp/send', otpSendLimiter, appAuthController.sendOtp)
router.post('/otp/verify', otpVerifyLimiter, appAuthController.verifyOtpAndSignIn)
router.post('/refresh', appAuthController.refresh)
router.post('/logout', requireAppAuth, appAuthController.logout)

export default router
