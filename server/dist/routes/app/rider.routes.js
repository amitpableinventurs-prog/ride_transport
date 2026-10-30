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
const auth = __importStar(require("../../controllers/app/auth.controller"));
const common = __importStar(require("../../controllers/common/common.controller"));
const account = __importStar(require("../../controllers/rider/account.controller"));
const trips = __importStar(require("../../controllers/rider/trips.controller"));
const wallet = __importStar(require("../../controllers/rider/wallet.controller"));
const profile = __importStar(require("../../controllers/app/profile.controller"));
const support = __importStar(require("../../controllers/app/support.controller"));
const appAuth_1 = require("../../middleware/appAuth");
const rateLimits_1 = require("../../middleware/rateLimits");
const uploads_1 = require("../../utils/uploads");
const overload_1 = require("../../middleware/overload");
const env_1 = require("../../config/env");
// SRS §10.3 rider app, mounted at /api/v1/rider. Riders are Driver accounts.
const router = (0, express_1.Router)();
// Terms and privacy policy: no login, so they can be shown on the sign-up screen.
router.get('/terms', common.appLegalPage('rider', 'terms'));
router.get('/privacy-policy', common.appLegalPage('rider', 'privacy'));
router.use(appAuth_1.rejectDuringMaintenance);
// Rider-only login: the account type is always a rider, so the body needs no role / userType.
const asRider = (req, _res, next) => {
    const { role: _role, userType: _userType, ...rest } = (req.body ?? {});
    req.body = { ...rest, userType: 'driver' };
    next();
};
router.post('/auth/otp/send', rateLimits_1.otpSendLimiter, asRider, auth.sendOtp);
router.post('/auth/otp/resend', rateLimits_1.otpSendLimiter, asRider, auth.sendOtp);
router.post('/auth/otp/verify', rateLimits_1.otpVerifyLimiter, asRider, auth.verifyOtpAndSignIn);
router.post('/auth/refresh', auth.refresh);
router.use(appAuth_1.requireAppAuth, (0, appAuth_1.requireAppUserType)('driver'), (0, overload_1.perUserLimiter)(env_1.env.appUserRateLimit));
router.post('/auth/logout', auth.logout);
router.get('/auth/me', account.getProfile);
router.get('/profile', account.getProfile);
router.patch('/profile', (0, uploads_1.singleUpload)('profile', 'photo', { imagesOnly: true }), profile.updateProfile);
router.get('/onboarding/options', account.getOnboardingOptions);
router.put('/onboarding/license', account.setLicenseChoice);
router.post('/onboarding', account.submitOnboarding);
router.get('/onboarding/status', account.getOnboardingStatus);
router.post('/documents', (0, uploads_1.multiUpload)('documents', ['file', 'backFile']), account.uploadDocument);
router.get('/documents', account.listDocuments);
router.get('/vehicle', account.getVehicle);
router.post('/vehicle', (0, uploads_1.multiUpload)('documents', ['rcFront', 'rcBack']), account.requestVehicle);
router.get('/approval-status', account.getApprovalStatus);
router.get('/performance', account.getPerformance);
router.get('/ratings', account.listRatings);
router.delete('/account', account.requestAccountDeletion);
router.post('/duty/online', account.goOnline);
router.post('/duty/offline', account.goOffline);
router.post('/selfie-check', (0, uploads_1.singleUpload)('selfies', 'selfie', { imagesOnly: true }), account.selfieCheck);
router.get('/requests/current', trips.currentRequest);
router.post('/requests/:bookingId/accept', trips.acceptRequest);
router.post('/requests/:bookingId/reject', trips.rejectRequest);
router.get('/bookings/active', trips.activeBooking);
router.get('/bookings', trips.listTrips);
router.post('/bookings/:id/arrived', trips.markArrived);
router.post('/bookings/:id/start', (0, uploads_1.singleUpload)('goods', 'goodsPhoto', { imagesOnly: true }), trips.startTrip);
router.post('/bookings/:id/stops/:stopId/complete', (0, uploads_1.singleUpload)('pod', 'pod', { imagesOnly: true }), trips.completeStop);
router.post('/bookings/:id/complete', trips.completeBooking);
router.post('/bookings/:id/cash-collected', trips.confirmCashCollected);
router.post('/bookings/:id/payment-qr', trips.createPaymentQr);
router.get('/bookings/:id/payment-qr', trips.getPaymentQrStatus);
router.post('/bookings/:id/cancel', trips.cancelByRider);
router.post('/bookings/:id/rating', trips.rateCustomer);
router.get('/earnings', trips.getEarnings);
router.get('/wallet', wallet.getWallet);
router.post('/wallet/pay-dues', wallet.payDues);
router.post('/payments/verify', wallet.verifyPayment);
router.get('/payments/orders/:orderId', wallet.getPaymentStatus);
router.post('/withdrawals', wallet.requestWithdrawal);
router.get('/withdrawals', wallet.listWithdrawals);
router.get('/incentives', account.listIncentives);
router.get('/heatmap', account.getHeatmap);
router.post('/sos', support.raiseSos);
router.get('/tickets', support.listTickets);
router.post('/tickets', support.createTicket);
router.get('/tickets/:id', support.getTicket);
router.get('/notifications', support.listNotifications);
exports.default = router;
//# sourceMappingURL=rider.routes.js.map