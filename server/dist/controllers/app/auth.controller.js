"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtp = sendOtp;
exports.verifyOtpAndLogin = verifyOtpAndLogin;
exports.verifyOtpAndSignIn = verifyOtpAndSignIn;
exports.register = register;
exports.refresh = refresh;
exports.me = me;
exports.logout = logout;
const Customer_1 = require("../../models/Customer");
const Driver_1 = require("../../models/Driver");
const TransportPartner_1 = require("../../models/TransportPartner");
const Device_1 = require("../../models/Device");
const trips_1 = require("../../services/trips");
const jwt_1 = require("../../utils/jwt");
const otp_1 = require("../../utils/otp");
const sessions_1 = require("../../utils/sessions");
const phone_1 = require("../../utils/phone");
const profileInput_1 = require("../../utils/profileInput");
const appUsers_1 = require("../../utils/appUsers");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INACTIVE_MESSAGE = 'This account has been suspended or blocked. Please contact support.';
function otpKey(userType, phone) {
    return `${userType}:${phone}`;
}
/** Customers get their fixed Ride PIN at their first login (accounts made before it existed included). */
async function prepareSignIn(user) {
    if (user.type === 'customer')
        await (0, trips_1.ensureRidePin)(user.doc._id);
}
function issueTokens(user) {
    const fid = (0, jwt_1.newSessionId)();
    return {
        accessToken: (0, jwt_1.signAppAccessToken)(user.doc.id, user.type, fid),
        refreshToken: (0, jwt_1.signAppRefreshToken)(user.doc.id, user.type, fid),
        user: (0, appUsers_1.serializeAppUser)(user),
    };
}
// SRS role names (/api/v1/auth) → account collections. A "rider" is a Driver record.
const ROLE_TO_USER_TYPE = { customer: 'customer', rider: 'driver' };
/** Validates { phone, userType } (or SRS { phone, role }) from the body; responds 400 and returns null when invalid. */
function readPhoneAndType(req, res) {
    const { phone: rawPhone, role } = req.body;
    const userType = typeof role === 'string' ? ROLE_TO_USER_TYPE[role] : req.body.userType;
    if (role !== undefined && !userType) {
        res.status(400).json({ message: 'role must be one of: customer, rider' });
        return null;
    }
    if (!jwt_1.APP_USER_TYPES.includes(userType)) {
        res.status(400).json({ message: `userType must be one of: ${jwt_1.APP_USER_TYPES.join(', ')}` });
        return null;
    }
    const phone = (0, phone_1.normalizeIndianMobile)(rawPhone);
    if (!phone) {
        res.status(400).json({ message: 'Enter a valid 10-digit Indian mobile number' });
        return null;
    }
    return { phone, userType: userType };
}
function sendOtpError(res, err) {
    if (err instanceof otp_1.OtpError) {
        res.status(err.status).json({ message: err.message, ...err.details });
        return;
    }
    throw err;
}
function optionalString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
// POST /otp/send and /otp/resend
async function sendOtp(req, res) {
    const input = readPhoneAndType(req, res);
    if (!input)
        return;
    const existing = await (0, appUsers_1.findAppUserByPhone)(input.userType, input.phone);
    if (existing && !(0, appUsers_1.isAppUserActive)(existing)) {
        res.status(403).json({ message: INACTIVE_MESSAGE });
        return;
    }
    try {
        const issued = await (0, otp_1.issueOtp)('app_login', otpKey(input.userType, input.phone), input.phone);
        res.json({ message: 'OTP sent', phone: (0, phone_1.maskPhone)(input.phone), ...issued });
    }
    catch (err) {
        sendOtpError(res, err);
    }
}
// POST /otp/verify
async function verifyOtpAndLogin(req, res) {
    const input = readPhoneAndType(req, res);
    if (!input)
        return;
    try {
        await (0, otp_1.verifyOtp)('app_login', otpKey(input.userType, input.phone), req.body.otp);
    }
    catch (err) {
        sendOtpError(res, err);
        return;
    }
    const user = await (0, appUsers_1.findAppUserByPhone)(input.userType, input.phone);
    if (!user) {
        res.json({ isNewUser: true, registrationToken: (0, jwt_1.signAppRegistrationToken)(input.phone, input.userType) });
        return;
    }
    if (!(0, appUsers_1.isAppUserActive)(user)) {
        res.status(403).json({ message: INACTIVE_MESSAGE });
        return;
    }
    await prepareSignIn(user);
    res.json({ isNewUser: false, ...issueTokens(user) });
}
// POST /api/v1/auth/otp/verify (SRS): a new number gets an account straight away and
// isNewUser: true; the app then shows the Profile screen (profileComplete: false).
async function verifyOtpAndSignIn(req, res) {
    const input = readPhoneAndType(req, res);
    if (!input)
        return;
    if (input.userType === 'partner') {
        res.status(400).json({ message: 'role must be one of: customer, rider' });
        return;
    }
    try {
        await (0, otp_1.verifyOtp)('app_login', otpKey(input.userType, input.phone), req.body.otp);
    }
    catch (err) {
        sendOtpError(res, err);
        return;
    }
    const existing = await (0, appUsers_1.findAppUserByPhone)(input.userType, input.phone);
    if (existing && !(0, appUsers_1.isAppUserActive)(existing)) {
        res.status(403).json({ message: INACTIVE_MESSAGE });
        return;
    }
    let user = existing;
    if (!user) {
        // New riders start as approvalStatus "pending" until onboarding + document checks are done.
        user =
            input.userType === 'customer'
                ? { type: 'customer', doc: await Customer_1.Customer.create({ phone: input.phone }) }
                : { type: 'driver', doc: await Driver_1.Driver.create({ phone: input.phone }) };
    }
    await prepareSignIn(user);
    res.status(existing ? 200 : 201).json({ isNewUser: !existing, ...issueTokens(user) });
}
// POST /register
async function register(req, res) {
    const body = req.body;
    const registration = (0, jwt_1.verifyAppRegistrationToken)(body.registrationToken);
    if (!registration) {
        res.status(401).json({ message: 'Registration session expired. Verify your phone number again.' });
        return;
    }
    const { phone, ut: userType } = registration;
    if (await (0, appUsers_1.findAppUserByPhone)(userType, phone)) {
        res.status(409).json({ message: 'This phone number is already registered. Please log in.' });
        return;
    }
    let user;
    if (userType === 'customer' || userType === 'driver') {
        // Fields from the app's Profile screen; name and emergency contact are required.
        const parsed = (0, profileInput_1.parseProfileInput)(body, { ownPhone: phone, partial: false, minAge: userType === 'driver' ? profileInput_1.DRIVER_MIN_AGE : undefined });
        if (!parsed.ok) {
            res.status(400).json({ message: parsed.message });
            return;
        }
        const { email, gender, dateOfBirth, ...profile } = parsed.value;
        const personal = { ...profile, phone, email: email ?? undefined, gender: gender ?? undefined, dateOfBirth: dateOfBirth ?? undefined };
        if (userType === 'customer') {
            const doc = await Customer_1.Customer.create({ ...personal, city: optionalString(body.city) });
            user = { type: 'customer', doc };
        }
        else {
            const serviceType = body.serviceType;
            if (serviceType !== 'rider' && serviceType !== 'transport') {
                res.status(400).json({ message: 'serviceType (rider or transport) is required' });
                return;
            }
            // New riders/drivers start as approvalStatus "pending" until an admin verifies their documents.
            const doc = await Driver_1.Driver.create({ ...personal, serviceType });
            user = { type: 'driver', doc };
        }
    }
    else {
        const companyName = optionalString(body.companyName);
        const ownerName = optionalString(body.ownerName);
        if (!companyName || !ownerName) {
            res.status(400).json({ message: 'companyName and ownerName are required' });
            return;
        }
        const email = optionalString(body.email)?.toLowerCase();
        if (email && !EMAIL_RE.test(email)) {
            res.status(400).json({ message: 'Enter a valid email address' });
            return;
        }
        const doc = await TransportPartner_1.TransportPartner.create({
            companyName,
            ownerName,
            email,
            phone,
            businessRegNo: optionalString(body.businessRegNo),
            taxId: optionalString(body.taxId),
        });
        user = { type: 'partner', doc };
    }
    await prepareSignIn(user);
    res.status(201).json(issueTokens(user));
}
// POST /refresh: refresh tokens are single-use; each call returns a new pair.
async function refresh(req, res) {
    const payload = (0, jwt_1.verifyAppRefreshToken)(req.body.refreshToken);
    if (!payload || (await (0, sessions_1.isSessionRevoked)(payload.fid))) {
        res.status(401).json({ message: 'Refresh token expired or invalid' });
        return;
    }
    // Single use: a token that was already exchanged is being replayed, so end the whole session.
    if (!(await (0, sessions_1.claimRefreshToken)(payload.jti, payload.exp))) {
        await (0, sessions_1.revokeSession)(payload.fid);
        res.status(401).json({ message: 'Your session is no longer valid. Please log in again.' });
        return;
    }
    const user = await (0, appUsers_1.findAppUserById)(payload.ut, payload.sub);
    if (!user || !(0, appUsers_1.isAppUserActive)(user)) {
        res.status(401).json({ message: 'Account unavailable' });
        return;
    }
    res.json({
        accessToken: (0, jwt_1.signAppAccessToken)(user.doc.id, user.type, payload.fid),
        refreshToken: (0, jwt_1.signAppRefreshToken)(user.doc.id, user.type, payload.fid),
    });
}
// GET /me
async function me(req, res) {
    res.json((0, appUsers_1.serializeAppUser)(req.appUser));
}
// POST /logout: revokes the refresh token and unregisters the device's push token.
async function logout(req, res) {
    const user = req.appUser;
    const { refreshToken, fcmToken } = (req.body ?? {});
    // Ends the whole login session, so the access token stops working immediately too.
    const payload = (0, jwt_1.verifyAppRefreshToken)(refreshToken);
    if (payload && payload.sub === user.doc.id && payload.ut === user.type)
        await (0, sessions_1.revokeSession)(payload.fid);
    else
        await (0, sessions_1.revokeSession)(req.appSessionId);
    if (typeof fcmToken === 'string' && fcmToken)
        await Device_1.Device.deleteOne({ token: fcmToken, userType: user.type, userId: user.doc._id });
    res.status(204).send();
}
//# sourceMappingURL=auth.controller.js.map