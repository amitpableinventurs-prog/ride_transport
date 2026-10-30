"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OtpError = void 0;
exports.issueOtp = issueOtp;
exports.verifyOtp = verifyOtp;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const OtpCode_1 = require("../models/OtpCode");
const Settings_1 = require("../models/Settings");
const NotificationTemplate_1 = require("../models/NotificationTemplate");
const sms_1 = require("./sms");
const DEFAULT_TEMPLATE = 'Your AnZ Cabs OTP is {{otp}}. Valid for {{expiry_minutes}} minutes. Do not share it with anyone.';
const HOUR_MS = 60 * 60 * 1000;
class OtpError extends Error {
    status;
    details;
    constructor(status, message, details = {}) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
exports.OtpError = OtpError;
function hashCode(key, code) {
    return crypto_1.default.createHmac('sha256', env_1.env.otpSecret).update(`${key}:${code}`).digest('hex');
}
function generateCode() {
    return crypto_1.default.randomInt(0, 1_000_000).toString().padStart(6, '0');
}
async function otpExpiryMinutes() {
    const settings = await Settings_1.Settings.findOne({ singleton: 'platform' }).select('otpExpiryMinutes');
    const minutes = settings?.otpExpiryMinutes ?? 5;
    return minutes > 0 ? minutes : 5;
}
async function renderMessage(code, expiryMinutes) {
    // Admins can edit the wording from Marketing → Notifications (template key "otp_sms").
    const template = await NotificationTemplate_1.NotificationTemplate.findOne({ key: 'otp_sms', status: 'active' }).select('body');
    const body = template?.body || DEFAULT_TEMPLATE;
    return body.replaceAll('{{otp}}', code).replaceAll('{{expiry_minutes}}', String(expiryMinutes));
}
/**
 * Creates (or replaces) the OTP for `key` and sends it by SMS.
 * Enforces a resend cooldown and a maximum number of sends per hour.
 */
async function issueOtp(purpose, key, destination) {
    const now = new Date();
    const existing = await OtpCode_1.OtpCode.findOne({ purpose, key });
    let sendCount = 1;
    let windowStartedAt = now;
    if (existing) {
        const secondsSinceLastSend = (now.getTime() - existing.lastSentAt.getTime()) / 1000;
        if (secondsSinceLastSend < env_1.env.otpResendCooldownSeconds) {
            const retryAfterSeconds = Math.ceil(env_1.env.otpResendCooldownSeconds - secondsSinceLastSend);
            throw new OtpError(429, `Please wait ${retryAfterSeconds}s before requesting another OTP.`, { retryAfterSeconds });
        }
        const windowActive = now.getTime() - existing.windowStartedAt.getTime() < HOUR_MS;
        if (windowActive) {
            if (existing.sendCount >= env_1.env.otpMaxSendsPerHour) {
                const retryAfterSeconds = Math.ceil((existing.windowStartedAt.getTime() + HOUR_MS - now.getTime()) / 1000);
                throw new OtpError(429, 'Too many OTP requests. Please try again later.', { retryAfterSeconds });
            }
            sendCount = existing.sendCount + 1;
            windowStartedAt = existing.windowStartedAt;
        }
    }
    const code = generateCode();
    const expiryMinutes = await otpExpiryMinutes();
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60 * 1000);
    await OtpCode_1.OtpCode.findOneAndUpdate({ purpose, key }, {
        purpose,
        key,
        channel: 'sms',
        destination,
        codeHash: hashCode(key, code),
        expiresAt,
        attempts: 0,
        sendCount,
        windowStartedAt,
        lastSentAt: now,
    }, { upsert: true, new: true, setDefaultsOnInsert: true });
    await (0, sms_1.getSmsProvider)().send(destination, await renderMessage(code, expiryMinutes));
    return {
        expiresInSeconds: expiryMinutes * 60,
        resendAfterSeconds: env_1.env.otpResendCooldownSeconds,
        ...(env_1.env.otpDevEcho ? { devOtp: code } : {}),
    };
}
/** Checks the code and consumes it on success. Throws OtpError otherwise. */
async function verifyOtp(purpose, key, code) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        throw new OtpError(400, 'Enter the 6-digit OTP.');
    }
    const otp = await OtpCode_1.OtpCode.findOne({ purpose, key });
    if (!otp || otp.expiresAt.getTime() < Date.now()) {
        throw new OtpError(400, 'OTP has expired. Please request a new one.');
    }
    if (otp.attempts >= env_1.env.otpMaxAttempts) {
        throw new OtpError(429, 'Too many incorrect attempts. Please request a new OTP.');
    }
    const expected = Buffer.from(otp.codeHash, 'hex');
    const actual = Buffer.from(hashCode(key, code), 'hex');
    if (!crypto_1.default.timingSafeEqual(expected, actual)) {
        otp.attempts += 1;
        await otp.save();
        const attemptsLeft = Math.max(0, env_1.env.otpMaxAttempts - otp.attempts);
        throw new OtpError(400, attemptsLeft > 0 ? 'Incorrect OTP.' : 'Too many incorrect attempts. Please request a new OTP.', {
            attemptsLeft,
        });
    }
    // Consume the code but keep the doc so the hourly send limit still applies.
    otp.expiresAt = new Date(0);
    await otp.save();
}
//# sourceMappingURL=otp.js.map