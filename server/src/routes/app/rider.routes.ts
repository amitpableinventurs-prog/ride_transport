import { Router } from 'express'
import * as account from '../../controllers/rider/account.controller'
import * as trips from '../../controllers/rider/trips.controller'
import * as wallet from '../../controllers/rider/wallet.controller'
import * as profile from '../../controllers/app/profile.controller'
import * as support from '../../controllers/app/support.controller'
import { rejectDuringMaintenance, requireAppAuth, requireAppUserType } from '../../middleware/appAuth'
import { singleUpload } from '../../utils/uploads'

// SRS §10.3 rider app, mounted at /api/v1/rider. Riders are Driver accounts.
const router = Router()

router.use(rejectDuringMaintenance, requireAppAuth, requireAppUserType('driver'))

router.get('/profile', profile.getProfile)
router.patch('/profile', singleUpload('profile', 'photo', { imagesOnly: true }), profile.updateProfile)
router.get('/onboarding/options', account.getOnboardingOptions)
router.post('/onboarding', account.submitOnboarding)
router.post('/documents', singleUpload('documents', 'file'), account.uploadDocument)
router.get('/documents', account.listDocuments)
router.get('/vehicle', account.getVehicle)
router.post('/vehicle', account.requestVehicle)
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
