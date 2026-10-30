"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushToTokens = pushToTokens;
exports.notifyUser = notifyUser;
const env_1 = require("../config/env");
const AppNotification_1 = require("../models/AppNotification");
const Device_1 = require("../models/Device");
const fcm_1 = require("./fcm");
// Development provider: prints pushes. PUSH_PROVIDER=fcm sends through Firebase (src/utils/fcm.ts).
const consoleProvider = {
    name: 'console',
    async send(userType, tokens, message) {
        console.log(`[push:console] to ${tokens.length} ${userType} device(s): ${message.title} — ${message.body}`);
        return { deadTokens: [] };
    },
};
const providers = { console: consoleProvider, fcm: fcm_1.fcmProvider };
function getPushProvider() {
    const provider = providers[env_1.env.pushProvider];
    if (!provider)
        throw new Error(`Unknown PUSH_PROVIDER "${env_1.env.pushProvider}". Available: ${Object.keys(providers).join(', ')}`);
    return provider;
}
/** Pushes to the given devices and forgets tokens the provider reports as gone. */
async function pushToTokens(userType, tokens, message) {
    if (!tokens.length)
        return;
    const { deadTokens } = await getPushProvider().send(userType, tokens, message);
    if (deadTokens.length)
        await Device_1.Device.deleteMany({ token: { $in: deadTokens } });
}
/** Saves the message to the user's in-app inbox and pushes it to their registered devices. */
async function notifyUser(userType, userId, message) {
    try {
        await AppNotification_1.AppNotification.create({ userType, userId, title: message.title, body: message.body, data: message.data });
        const tokens = await Device_1.Device.find({ userType, userId }).distinct('token');
        await pushToTokens(userType, tokens, message);
    }
    catch (err) {
        // A failed notification must never fail the booking action that triggered it.
        console.error('[notify] failed', err);
    }
}
//# sourceMappingURL=notify.js.map