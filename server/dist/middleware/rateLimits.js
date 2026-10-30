"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorReportLimiter = exports.otpVerifyLimiter = exports.otpSendLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
exports.otpSendLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many OTP requests. Please try again later.' },
});
exports.otpVerifyLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many attempts. Please try again later.' },
});
// App error reports: one failure can cause a few at once, but a device stuck in a crash loop must not flood the logs.
exports.errorReportLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many error reports. Please try again later.' },
});
//# sourceMappingURL=rateLimits.js.map