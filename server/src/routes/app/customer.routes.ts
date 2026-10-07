import { Router } from 'express'
import * as account from '../../controllers/customer/account.controller'
import * as home from '../../controllers/customer/home.controller'
import * as bookings from '../../controllers/customer/bookings.controller'
import * as payments from '../../controllers/customer/payments.controller'
import * as profile from '../../controllers/app/profile.controller'
import * as support from '../../controllers/app/support.controller'
import { rejectDuringMaintenance, requireAppAuth, requireAppUserType } from '../../middleware/appAuth'
import { singleUpload } from '../../utils/uploads'
import { perUserLimiter } from '../../middleware/overload'
import { env } from '../../config/env'

// SRS §10.2 customer app, mounted at /api/v1/customer.
const router = Router()

router.use(rejectDuringMaintenance, requireAppAuth, requireAppUserType('customer'), perUserLimiter(env.appUserRateLimit))

router.get('/profile', profile.getProfile)
router.patch('/profile', singleUpload('profile', 'photo', { imagesOnly: true }), profile.updateProfile)

router.get('/home', home.getHome)
router.get('/all-services', home.getAllServices)
router.get('/recent-places', home.listRecentPlaces)
router.get('/places/search', home.searchPlaces)
router.get('/places/reverse', home.reverseGeocode)
router.get('/referral', home.getReferral)
router.post('/referral/apply', home.applyReferral)

router.get('/saved-places', account.listSavedPlaces)
router.post('/saved-places', account.addSavedPlace)
router.delete('/saved-places/:id', account.deleteSavedPlace)

router.get('/emergency-contacts', account.getEmergencyContacts)
router.put('/emergency-contacts', account.putEmergencyContacts)

router.get('/services', account.listServices)
router.post('/fare-estimate', bookings.fareEstimate)
router.post('/coupons/validate', account.validateCoupon)

router.post('/bookings', bookings.createBooking)
router.get('/bookings', bookings.listBookings)
router.get('/bookings/:id', bookings.getBooking)
router.get('/bookings/:id/track', bookings.trackBooking)
router.patch('/bookings/:id/drop', bookings.changeDrop)
router.post('/bookings/:id/cancel', bookings.cancelBooking)
router.post('/bookings/:id/retry', bookings.retryBooking)
router.post('/bookings/:id/rating', bookings.rateRider)
router.get('/bookings/:id/invoice', bookings.getInvoice)
router.post('/bookings/:id/share', bookings.shareBooking)
router.post('/bookings/:id/call', bookings.callRider)

router.get('/wallet', payments.getWallet)
router.post('/wallet/topup', payments.topUpWallet)
router.post('/payments/order', payments.createPaymentOrder)
router.post('/payments/verify', payments.verifyPayment)

router.get('/offers', account.listOffers)
router.post('/sos', support.raiseSos)
router.get('/tickets', support.listTickets)
router.post('/tickets', support.createTicket)
router.get('/notifications', support.listNotifications)
router.delete('/account', account.requestAccountDeletion)

export default router
