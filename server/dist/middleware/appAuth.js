"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAppAuth = requireAppAuth;
exports.optionalAppAuth = optionalAppAuth;
exports.requireAppUserType = requireAppUserType;
exports.rejectDuringMaintenance = rejectDuringMaintenance;
const settings_1 = require("../utils/settings");
const jwt_1 = require("../utils/jwt");
const sessions_1 = require("../utils/sessions");
const appUsers_1 = require("../utils/appUsers");
/** The active app user and session of the request's Bearer token, or null. */
async function appSessionFromRequest(req) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = token ? (0, jwt_1.verifyAppAccessToken)(token) : null;
    if (!payload || (await (0, sessions_1.isSessionRevoked)(payload.fid)))
        return null;
    const user = await (0, appUsers_1.findAppUserById)(payload.ut, payload.sub);
    return user && (0, appUsers_1.isAppUserActive)(user) ? { user, sessionId: payload.fid } : null;
}
async function requireAppAuth(req, res, next) {
    const session = await appSessionFromRequest(req);
    if (!session) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    req.appUser = session.user;
    req.appSessionId = session.sessionId;
    next();
}
/** Like requireAppAuth, but without a valid token the request goes on with no req.appUser. */
async function optionalAppAuth(req, _res, next) {
    const session = await appSessionFromRequest(req);
    if (session) {
        req.appUser = session.user;
        req.appSessionId = session.sessionId;
    }
    next();
}
/** Limits a router to one kind of app account (the customer app vs the rider app). Use after requireAppAuth. */
function requireAppUserType(type) {
    return (req, res, next) => {
        if (req.appUser?.type !== type) {
            res.status(403).json({ message: `This API is only available to ${type === 'driver' ? 'rider' : type} accounts` });
            return;
        }
        next();
    };
}
// Settings → Maintenance mode takes the mobile apps offline without affecting the admin panel.
async function rejectDuringMaintenance(_req, res, next) {
    const settings = await (0, settings_1.getPlatformSettings)();
    if (settings.maintenanceMode) {
        res.status(503).json({ message: 'The platform is under maintenance. Please try again later.' });
        return;
    }
    next();
}
//# sourceMappingURL=appAuth.js.map