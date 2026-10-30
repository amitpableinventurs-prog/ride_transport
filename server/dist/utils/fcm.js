"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fcmProvider = exports.ANDROID_CHANNELS = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
const env_1 = require("../config/env");
const PROJECT_FOR_USER = { customer: 'customer', driver: 'rider' };
// Android notification channels the apps create (high importance for booking requests).
exports.ANDROID_CHANNELS = { bookingRequests: 'booking_requests', general: 'general' };
// FCM accepts at most 500 tokens per multicast call.
const MULTICAST_LIMIT = 500;
// Tokens FCM will never deliver to again (app uninstalled, token rotated).
const DEAD_TOKEN_ERRORS = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);
const apps = new Map();
/** FIREBASE_*_SERVICE_ACCOUNT is a path to the service account JSON file, or the JSON itself. */
function loadServiceAccount(setting) {
    const text = setting.trim().startsWith('{') ? setting : fs_1.default.readFileSync(path_1.default.resolve(setting), 'utf8');
    return JSON.parse(text);
}
function appFor(project) {
    if (!apps.has(project)) {
        const name = `FIREBASE_${project.toUpperCase()}_SERVICE_ACCOUNT`;
        const setting = project === 'rider' ? env_1.env.fcmRiderServiceAccount : env_1.env.fcmCustomerServiceAccount;
        let app = null;
        if (!setting)
            console.warn(`[push:fcm] ${name} is not set; ${project} app pushes are skipped`);
        else {
            try {
                app = (0, app_1.initializeApp)({ credential: (0, app_1.cert)(loadServiceAccount(setting)) }, `fcm-${project}`);
            }
            catch (err) {
                // Logged once; fix the key and restart the server.
                console.error(`[push:fcm] ${name} could not be loaded; ${project} app pushes are skipped:`, err.message);
            }
        }
        apps.set(project, app);
    }
    return apps.get(project);
}
function buildMessage(tokens, message) {
    const isBookingRequest = message.data?.type === 'booking_request';
    return {
        tokens,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: {
            priority: 'high',
            ...(message.ttlSeconds ? { ttl: message.ttlSeconds * 1000 } : {}),
            notification: { channelId: isBookingRequest ? exports.ANDROID_CHANNELS.bookingRequests : exports.ANDROID_CHANNELS.general, sound: 'default' },
        },
        apns: {
            headers: {
                'apns-priority': '10',
                ...(message.ttlSeconds ? { 'apns-expiration': String(Math.floor(Date.now() / 1000) + message.ttlSeconds) } : {}),
            },
            payload: { aps: { sound: 'default' } },
        },
    };
}
exports.fcmProvider = {
    name: 'fcm',
    async send(userType, tokens, message) {
        const project = PROJECT_FOR_USER[userType];
        const app = project ? appFor(project) : null;
        if (!app)
            return { deadTokens: [] };
        const deadTokens = [];
        for (let i = 0; i < tokens.length; i += MULTICAST_LIMIT) {
            const batch = tokens.slice(i, i + MULTICAST_LIMIT);
            const result = await (0, messaging_1.getMessaging)(app).sendEachForMulticast(buildMessage(batch, message));
            result.responses.forEach((r, j) => {
                if (r.success)
                    return;
                if (r.error && DEAD_TOKEN_ERRORS.has(r.error.code))
                    deadTokens.push(batch[j]);
                else
                    console.error(`[push:fcm] ${project} send failed: ${r.error?.code} ${r.error?.message}`);
            });
        }
        return { deadTokens };
    },
};
//# sourceMappingURL=fcm.js.map