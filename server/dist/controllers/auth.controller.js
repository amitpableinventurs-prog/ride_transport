"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.verifyLoginOtp = verifyLoginOtp;
exports.resendLoginOtp = resendLoginOtp;
exports.refresh = refresh;
exports.logout = logout;
exports.me = me;
const Admin_1 = require("../models/Admin");
const Role_1 = require("../models/Role");
const Settings_1 = require("../models/Settings");
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const sessions_1 = require("../utils/sessions");
const audit_1 = require("../utils/audit");
const roles_1 = require("../utils/roles");
const otp_1 = require("../utils/otp");
const phone_1 = require("../utils/phone");
async function toAuthUser(admin) {
    const role = await Role_1.Role.findOne({ key: admin.role });
    return {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        roleName: role?.name ?? (0, roles_1.roleDisplayName)(admin.role),
        permissions: role?.permissions ?? [],
    };
}
async function completeLogin(admin, res) {
    const fid = (0, jwt_1.newSessionId)();
    const accessToken = (0, jwt_1.signAccessToken)(admin.id, fid);
    const refreshToken = (0, jwt_1.signRefreshToken)(admin.id, fid);
    admin.lastLoginAt = new Date();
    await admin.save();
    await (0, audit_1.recordAudit)(admin, 'auth.login', 'Session', admin.email);
    res.json({ accessToken, refreshToken, user: await toAuthUser(admin) });
}
function sendOtpError(res, err) {
    if (err instanceof otp_1.OtpError) {
        res.status(err.status).json({ message: err.message, ...err.details });
        return;
    }
    throw err;
}
async function loadChallengeAdmin(otpToken, res) {
    const payload = (0, jwt_1.verifyOtpChallengeToken)(otpToken);
    if (!payload) {
        res.status(401).json({ message: 'Your sign-in session expired. Please sign in again.' });
        return null;
    }
    const admin = await Admin_1.Admin.findById(payload.sub);
    if (!admin || admin.status === 'suspended') {
        res.status(401).json({ message: 'Account unavailable' });
        return null;
    }
    return admin;
}
async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required' });
        return;
    }
    const admin = await Admin_1.Admin.findOne({ email: email.trim().toLowerCase() });
    if (!admin || !(await (0, password_1.comparePassword)(password, admin.passwordHash))) {
        res.status(401).json({ message: 'Invalid email or password' });
        return;
    }
    if (admin.status === 'suspended') {
        res.status(403).json({ message: 'This account has been suspended. Contact a Super Admin.' });
        return;
    }
    const settings = await Settings_1.Settings.findOne({ singleton: 'platform' }).select('adminLoginOtpEnabled');
    if (settings?.adminLoginOtpEnabled === false) {
        await completeLogin(admin, res);
        return;
    }
    try {
        const issued = await (0, otp_1.issueOtp)('admin_login', admin.id, admin.phone);
        res.json({
            otpRequired: true,
            otpToken: (0, jwt_1.signOtpChallengeToken)(admin.id),
            maskedPhone: (0, phone_1.maskPhone)(admin.phone),
            ...issued,
        });
    }
    catch (err) {
        sendOtpError(res, err);
    }
}
async function verifyLoginOtp(req, res) {
    const { otpToken, otp } = req.body;
    const admin = await loadChallengeAdmin(otpToken, res);
    if (!admin)
        return;
    try {
        await (0, otp_1.verifyOtp)('admin_login', admin.id, otp);
    }
    catch (err) {
        sendOtpError(res, err);
        return;
    }
    await completeLogin(admin, res);
}
async function resendLoginOtp(req, res) {
    const { otpToken } = req.body;
    const admin = await loadChallengeAdmin(otpToken, res);
    if (!admin)
        return;
    try {
        const issued = await (0, otp_1.issueOtp)('admin_login', admin.id, admin.phone);
        res.json({ maskedPhone: (0, phone_1.maskPhone)(admin.phone), ...issued });
    }
    catch (err) {
        sendOtpError(res, err);
    }
}
async function refresh(req, res) {
    const { refreshToken } = req.body;
    const payload = (0, jwt_1.verifyRefreshToken)(refreshToken);
    if (!payload || (await (0, sessions_1.isSessionRevoked)(payload.fid))) {
        res.status(401).json({ message: 'Refresh token expired or invalid' });
        return;
    }
    // Single use: a token that was already exchanged is being replayed, so end the whole session.
    if (!(await (0, sessions_1.claimRefreshToken)(payload.jti, payload.exp))) {
        await (0, sessions_1.revokeSession)(payload.fid);
        res.status(401).json({ message: 'Your session is no longer valid. Please sign in again.' });
        return;
    }
    const admin = await Admin_1.Admin.findById(payload.sub);
    if (!admin || admin.status === 'suspended') {
        res.status(401).json({ message: 'Account unavailable' });
        return;
    }
    res.json({
        accessToken: (0, jwt_1.signAccessToken)(admin.id, payload.fid),
        refreshToken: (0, jwt_1.signRefreshToken)(admin.id, payload.fid),
    });
}
async function logout(req, res) {
    // Ends the whole login session, so the access token stops working immediately too.
    await (0, sessions_1.revokeSession)(req.adminSessionId);
    if (req.admin) {
        await (0, audit_1.recordAudit)(req.admin, 'auth.logout', 'Session', req.admin.email);
    }
    res.status(204).send();
}
async function me(req, res) {
    if (!req.admin) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    res.json(await toAuthUser(req.admin));
}
//# sourceMappingURL=auth.controller.js.map