"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appUserFields = appUserFields;
exports.recordServerError = recordServerError;
const ErrorLog_1 = require("../models/ErrorLog");
/** Name, phone and id of a signed-in app user, for an error log entry. */
function appUserFields(user) {
    const name = user.type === 'partner' ? user.doc.ownerName : user.doc.name;
    return { userType: user.type, userId: user.doc._id, userName: name || undefined, userPhone: user.doc.phone };
}
/**
 * Records an unexpected API error in Error Logs (System → Error Logs in the admin panel).
 * Never throws: when the database itself is the problem the error is only printed.
 */
async function recordServerError(err, req) {
    try {
        const error = err instanceof Error ? err : new Error(String(err));
        const admin = req?.admin;
        await ErrorLog_1.ErrorLog.create({
            source: 'api',
            level: 'error',
            message: error.message.slice(0, 1000) || error.name,
            stack: error.stack?.slice(0, 8000),
            // The path without the query string, which can carry tokens.
            screen: req ? `${req.method} ${req.originalUrl.split('?')[0]}`.slice(0, 200) : 'background task',
            platform: 'server',
            ...(admin
                ? { userType: 'admin', userId: admin._id, userName: admin.name }
                : req?.appUser
                    ? appUserFields(req.appUser)
                    : {}),
            ip: req?.ip,
            occurredAt: new Date(),
        });
    }
    catch (logErr) {
        console.error('[error-logs] could not record error', logErr);
    }
}
//# sourceMappingURL=errorLogs.js.map