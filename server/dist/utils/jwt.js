"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_USER_TYPES = exports.newSessionId = exports.AUDIENCE = void 0;
exports.signAccessToken = signAccessToken;
exports.signRefreshToken = signRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.signOtpChallengeToken = signOtpChallengeToken;
exports.verifyOtpChallengeToken = verifyOtpChallengeToken;
exports.signAppAccessToken = signAppAccessToken;
exports.signAppRefreshToken = signAppRefreshToken;
exports.verifyAppAccessToken = verifyAppAccessToken;
exports.verifyAppRefreshToken = verifyAppRefreshToken;
exports.signAppRegistrationToken = signAppRegistrationToken;
exports.verifyAppRegistrationToken = verifyAppRegistrationToken;
exports.signInvoiceToken = signInvoiceToken;
exports.verifyInvoiceToken = verifyInvoiceToken;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../config/env");
// Every token is HS256, carries an issuer, an audience for its purpose, a unique id (jti) and, for sessions,
// a family id (fid). The audience stops a token made for one purpose from being accepted for another even if
// two purposes share a secret; the fid lets a whole login session be revoked at once (logout, refresh-token reuse).
const ISSUER = 'anzcabs-api';
const ALGORITHM = 'HS256';
exports.AUDIENCE = {
    adminAccess: 'admin:access',
    adminRefresh: 'admin:refresh',
    adminOtp: 'admin:otp-challenge',
    appAccess: 'app:access',
    appRefresh: 'app:refresh',
    appRegistration: 'app:registration',
    invoice: 'public:invoice',
};
function sign(payload, secret, audience, expiresIn) {
    return jsonwebtoken_1.default.sign(payload, secret, { algorithm: ALGORITHM, issuer: ISSUER, audience, expiresIn, jwtid: crypto_1.default.randomUUID() });
}
function verify(token, secret, audience, type) {
    if (typeof token !== 'string' || !token || token.length > 4000)
        return null;
    try {
        const payload = jsonwebtoken_1.default.verify(token, secret, { algorithms: [ALGORITHM], issuer: ISSUER, audience });
        return payload.type === type ? payload : null;
    }
    catch {
        return null;
    }
}
const newSessionId = () => crypto_1.default.randomUUID();
exports.newSessionId = newSessionId;
function signAccessToken(adminId, fid, ttlMinutes = env_1.env.accessTokenTtlMinutes) {
    return sign({ sub: adminId, fid, type: 'access' }, env_1.env.jwtAccessSecret, exports.AUDIENCE.adminAccess, `${ttlMinutes}m`);
}
function signRefreshToken(adminId, fid, ttlDays = env_1.env.refreshTokenTtlDays) {
    return sign({ sub: adminId, fid, type: 'refresh' }, env_1.env.jwtRefreshSecret, exports.AUDIENCE.adminRefresh, `${ttlDays}d`);
}
function verifyAccessToken(token) {
    return verify(token, env_1.env.jwtAccessSecret, exports.AUDIENCE.adminAccess, 'access');
}
function verifyRefreshToken(token) {
    return verify(token, env_1.env.jwtRefreshSecret, exports.AUDIENCE.adminRefresh, 'refresh');
}
const OTP_CHALLENGE_TTL_MINUTES = 10;
function signOtpChallengeToken(adminId) {
    return sign({ sub: adminId, type: 'admin_otp' }, env_1.env.jwtAccessSecret, exports.AUDIENCE.adminOtp, `${OTP_CHALLENGE_TTL_MINUTES}m`);
}
function verifyOtpChallengeToken(token) {
    return verify(token, env_1.env.jwtAccessSecret, exports.AUDIENCE.adminOtp, 'admin_otp');
}
exports.APP_USER_TYPES = ['customer', 'driver', 'partner'];
function signAppAccessToken(userId, userType, fid) {
    return sign({ sub: userId, ut: userType, fid, type: 'app_access' }, env_1.env.jwtAppAccessSecret, exports.AUDIENCE.appAccess, `${env_1.env.appAccessTokenTtlMinutes}m`);
}
function signAppRefreshToken(userId, userType, fid) {
    return sign({ sub: userId, ut: userType, fid, type: 'app_refresh' }, env_1.env.jwtAppRefreshSecret, exports.AUDIENCE.appRefresh, `${env_1.env.appRefreshTokenTtlDays}d`);
}
function verifyAppAccessToken(token) {
    const payload = verify(token, env_1.env.jwtAppAccessSecret, exports.AUDIENCE.appAccess, 'app_access');
    return payload && exports.APP_USER_TYPES.includes(payload.ut) ? payload : null;
}
function verifyAppRefreshToken(token) {
    const payload = verify(token, env_1.env.jwtAppRefreshSecret, exports.AUDIENCE.appRefresh, 'app_refresh');
    return payload && exports.APP_USER_TYPES.includes(payload.ut) ? payload : null;
}
// Proves the phone number was verified by OTP; lets a new user finish sign-up.
const REGISTRATION_TTL_MINUTES = 30;
function signAppRegistrationToken(phone, userType) {
    return sign({ phone, ut: userType, type: 'app_registration' }, env_1.env.jwtAppAccessSecret, exports.AUDIENCE.appRegistration, `${REGISTRATION_TTL_MINUTES}m`);
}
function verifyAppRegistrationToken(token) {
    const payload = verify(token, env_1.env.jwtAppAccessSecret, exports.AUDIENCE.appRegistration, 'app_registration');
    return payload && exports.APP_USER_TYPES.includes(payload.ut) ? payload : null;
}
// ---- Public invoice links ----
// The invoice URL is opened outside the app (browser / share sheet), so it carries its own short-lived token.
const INVOICE_TTL_DAYS = 7;
function signInvoiceToken(bookingId) {
    return sign({ bid: bookingId, type: 'invoice' }, env_1.env.jwtAppAccessSecret, exports.AUDIENCE.invoice, `${INVOICE_TTL_DAYS}d`);
}
function verifyInvoiceToken(token) {
    const payload = verify(token, env_1.env.jwtAppAccessSecret, exports.AUDIENCE.invoice, 'invoice');
    return payload?.bid ? payload.bid : null;
}
//# sourceMappingURL=jwt.js.map