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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const authController = __importStar(require("../controllers/auth.controller"));
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const schemas = __importStar(require("../validation/schemas"));
const router = (0, express_1.Router)();
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    // Only failed sign-ins count, so normal use never locks an admin out.
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many login attempts. Please try again later.' },
});
// Per account, so one email cannot be brute-forced from many IP addresses.
const emailLoginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `login:${typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : 'none'}`,
    message: { message: 'Too many login attempts for this account. Please try again later.' },
});
const otpLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many OTP attempts. Please try again later.' },
});
router.post('/login', loginLimiter, emailLoginLimiter, (0, validate_1.validate)({ body: schemas.adminLoginBody }), authController.login);
router.post('/login/verify-otp', otpLimiter, (0, validate_1.validate)({ body: schemas.adminVerifyOtpBody }), authController.verifyLoginOtp);
router.post('/login/resend-otp', otpLimiter, (0, validate_1.validate)({ body: schemas.adminResendOtpBody }), authController.resendLoginOtp);
router.post('/refresh', (0, validate_1.validate)({ body: schemas.refreshBody }), authController.refresh);
router.post('/logout', auth_1.requireAuth, authController.logout);
router.get('/me', auth_1.requireAuth, authController.me);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map