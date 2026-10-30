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
const appAuthController = __importStar(require("../../controllers/app/auth.controller"));
const appProfileController = __importStar(require("../../controllers/app/profile.controller"));
const appAuth_1 = require("../../middleware/appAuth");
const rateLimits_1 = require("../../middleware/rateLimits");
// APIs for the Flutter customer / rider-driver / partner apps, mounted at /api/v1/app.
const router = (0, express_1.Router)();
router.use(appAuth_1.rejectDuringMaintenance);
router.post('/auth/otp/send', rateLimits_1.otpSendLimiter, appAuthController.sendOtp);
router.post('/auth/otp/resend', rateLimits_1.otpSendLimiter, appAuthController.sendOtp);
router.post('/auth/otp/verify', rateLimits_1.otpVerifyLimiter, appAuthController.verifyOtpAndLogin);
router.post('/auth/register', rateLimits_1.otpVerifyLimiter, appAuthController.register);
router.post('/auth/refresh', appAuthController.refresh);
router.get('/auth/me', appAuth_1.requireAppAuth, appAuthController.me);
router.post('/auth/logout', appAuth_1.requireAppAuth, appAuthController.logout);
router.get('/profile', appAuth_1.requireAppAuth, appProfileController.getProfile);
router.patch('/profile', appAuth_1.requireAppAuth, appProfileController.updateProfile);
exports.default = router;
//# sourceMappingURL=index.js.map