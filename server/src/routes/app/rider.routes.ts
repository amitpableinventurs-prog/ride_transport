import { Router } from 'express'
import * as auth from '../../controllers/app/auth.controller'
import * as account from '../../controllers/rider/account.controller'
import * as trips from '../../controllers/rider/trips.controller'
import * as wallet from '../../controllers/rider/wallet.controller'
import * as profile from '../../controllers/app/profile.controller'
import * as support from '../../controllers/app/support.controller'
import { rejectDuringMaintenance, requireAppAuth, requireAppUserType } from '../../middleware/appAuth'
import { otpSendLimiter, otpVerifyLimiter } from '../../middleware/rateLimits'
import { multiUpload, singleUpload } from '../../utils/uploads'
import type { RequestHandler } from 'express'

// SRS §10.3 rider app, mounted at /api/v1/rider. Riders are Driver accounts.
const router = Router()

router.use(rejectDuringMaintenance)

// Rider-only login: the account type is always a rider, so the body needs no role / userType.
const asRider: RequestHandler = (req, _res, next) => {
  const { role: _role, userType: _userType, ...rest } = (req.body ?? {}) as Record<string, unknown>
  req.body = { ...rest, userType: 'driver' }
  next()
}
router.post('/auth/otp/send', otpSendLimiter, asRider, auth.sendOtp)
router.post('/auth/otp/resend', otpSendLimiter, asRider, auth.sendOtp)
router.post('/auth/otp/verify', otpVerifyLimiter, asRider, auth.verifyOtpAndSignIn)
router.post('/auth/refresh', auth.refresh)

router.use(requireAppAuth, requireAppUserType('driver'))
router.post('/auth/logout', auth.logout)
router.get('/auth/me', profile.getProfile)

router.get('/profile', profile.getProfile)
router.patch('/profile', singleUpload('profile', 'photo', { imagesOnly: true }), profile.updateProfile)
router.get('/onboarding/options', account.getOnboardingOptions)
router.put('/onboarding/license', account.setLicenseChoice)
router.post('/onboarding', account.submitOnboarding)
router.get('/onboarding/status', account.getOnboardingStatus)
router.post('/documents', multiUpload('documents', ['file', 'backFile']), account.uploadDocument)
router.get('/documents', account.listDocuments)
router.get('/vehicle', account.getVehicle)
router.post('/vehicle', multiUpload('documents', ['rcFront', 'rcBack']), account.requestVehicle)
router.get('/approval-status', account.getApprovalStatus)

router.post('/duty/online', account.goOnline)
router.post('/duty/offline', account.goOffline)
router.post('/selfie-check', singleUpload('selfies', 'selfie', { imagesOnly: true }), account.selfieCheck)

router.get('/requests/current', trips.currentRequest)
router.post('/requests/:bookingId/accept', trips.acceptRequest)
router.post('/requests/:bookingId/reject', trips.rejectRequest)

router.get('/bookings/active', trips.activeBooking)
router.get('/bookings', trips.listTrips)
router.post('/bookings/:id/arrived', trips.markArrived)
router.post('/bookings/:id/start', singleUpload('goods', 'goodsPhoto', { imagesOnly: true }), trips.startTrip)
router.post('/bookings/:id/stops/:stopId/complete', singleUpload('pod', 'pod', { imagesOnly: true }), trips.completeStop)
router.post('/bookings/:id/complete', trips.completeBooking)
router.post('/bookings/:id/cash-collected', trips.confirmCashCollected)
router.post('/bookings/:id/cancel', trips.cancelByRider)
router.post('/bookings/:id/rating', trips.rateCustomer)

router.get('/earnings', trips.getEarnings)
router.get('/wallet', wallet.getWallet)
router.post('/wallet/pay-dues', wallet.payDues)
router.post('/payments/verify', wallet.verifyPayment)
router.post('/withdrawals', wallet.requestWithdrawal)
router.get('/withdrawals', wallet.listWithdrawals)

router.get('/incentives', account.listIncentives)
router.get('/heatmap', account.getHeatmap)
router.post('/sos', support.raiseSos)
router.get('/tickets', support.listTickets)
router.post('/tickets', support.createTicket)
router.get('/notifications', support.listNotifications)

export default router
