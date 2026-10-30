"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTelephonyProvider = getTelephonyProvider;
const env_1 = require("../config/env");
const http_1 = require("./http");
// Development provider: returns the other party's real number. Add a masked-calling
// provider (Exotel, Knowlarity, Twilio Proxy, ...) here and select it with TELEPHONY_PROVIDER.
const directProvider = {
    name: 'direct',
    async bridge(_bookingId, _from, to) {
        return { number: to, masked: false };
    },
};
const providers = { direct: directProvider };
function getTelephonyProvider() {
    const provider = providers[env_1.env.telephonyProvider];
    if (!provider)
        throw new Error(`Unknown TELEPHONY_PROVIDER "${env_1.env.telephonyProvider}". Available: ${Object.keys(providers).join(', ')}`);
    // Never hand out real numbers in production.
    if (provider === directProvider && env_1.env.isProduction)
        throw new http_1.HttpError(503, 'Calling is not available right now');
    return provider;
}
//# sourceMappingURL=telephony.js.map