"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const account = __importStar(require("../../controllers/customer/account.controller"));
const common = __importStar(require("../../controllers/common/common.controller"));
const home = __importStar(require("../../controllers/customer/home.controller"));
const bookings = __importStar(require("../../controllers/customer/bookings.controller"));
const payments = __importStar(require("../../controllers/customer/payments.controller"));
const profile = __importStar(require("../../controllers/app/profile.controller"));
const profileMenu = __importStar(require("../../controllers/customer/profileMenu.controller"));
const support = __importStar(require("../../controllers/app/support.controller"));
const appAuth_1 = require("../../middleware/appAuth");
const uploads_1 = require("../../utils/uploads");
const overload_1 = require("../../middleware/overload");
const env_1 = require("../../config/env");
// SRS §10.2 customer app, mounted at /api/v1/customer.
const router = (0, express_1.Router)();
// Terms and privacy policy: no login, so they can be shown on the sign-up screen.
router.get('/terms', common.appLegalPage('customer', 'terms'));
router.get('/privacy-policy', common.appLegalPage('customer', 'privacy'));
router.use(appAuth_1.rejectDuringMaintenance, appAuth_1.requireAppAuth, (0, appAuth_1.requireAppUserType)('customer'), (0, overload_1.perUserLimiter)(env_1.env.appUserRateLimit));
router.get('/profile', profile.getProfile);
router.patch('/profile', (0, uploads_1.singleUpload)('profile', 'photo', { imagesOnly: true }), profile.updateProfile);
router.get('/profile/menu', profileMenu.getProfileMenu);
router.get('/settings', profileMenu.getSettings);
router.patch('/settings', profileMenu.updateSettings);
router.get('/home', home.getHome);
router.get('/all-services', home.getAllServices);
router.get('/recent-places', home.listRecentPlaces);
router.get('/places/search', home.searchPlaces);
router.get('/places/reverse', home.reverseGeocode);
router.get('/referral', home.getReferral);
router.post('/referral/apply', home.applyReferral);
router.get('/saved-places', account.listSavedPlaces);
router.post('/saved-places', account.addSavedPlace);
router.delete('/saved-places/:id', account.deleteSavedPlace);
router.get('/emergency-contacts', account.getEmergencyContacts);
router.put('/emergency-contacts', account.putEmergencyContacts);
router.get('/services', account.listServices);
router.post('/fare-estimate', bookings.fareEstimate);
router.post('/coupons/validate', account.validateCoupon);
router.post('/bookings', bookings.createBooking);
router.get('/bookings', bookings.listBookings);
router.get('/bookings/:id', bookings.getBooking);
router.get('/bookings/:id/track', bookings.trackBooking);
router.patch('/bookings/:id/drop', bookings.changeDrop);
router.post('/bookings/:id/cancel', bookings.cancelBooking);
router.post('/bookings/:id/retry', bookings.retryBooking);
router.post('/bookings/:id/rating', bookings.rateRider);
router.get('/bookings/:id/invoice', bookings.getInvoice);
router.post('/bookings/:id/share', bookings.shareBooking);
router.post('/bookings/:id/call', bookings.callRider);
router.get('/wallet', payments.getWallet);
router.post('/wallet/topup', payments.topUpWallet);
router.post('/payments/order', payments.createPaymentOrder);
router.post('/payments/verify', payments.verifyPayment);
router.get('/payments/orders/:orderId', payments.getPaymentStatus);
router.get('/payments/methods', account.listPaymentMethods);
router.get('/offers', account.listOffers);
router.get('/rewards', account.listRewards);
router.get('/coins', account.getCoins);
router.get('/help', profileMenu.getHelp);
router.get('/safety', profileMenu.getSafety);
router.post('/sos', support.raiseSos);
router.get('/tickets', support.listTickets);
router.post('/tickets', support.createTicket);
router.get('/tickets/:id', support.getTicket);
router.get('/claims', profileMenu.listClaims);
router.post('/claims', (0, uploads_1.multiUpload)('claims', ['photo1', 'photo2', 'photo3'], { imagesOnly: true }), profileMenu.createClaim);
router.get('/claims/:id', profileMenu.getClaim);
router.get('/notifications', support.listNotifications);
router.delete('/account', account.requestAccountDeletion);
exports.default = router;
//# sourceMappingURL=customer.routes.js.map