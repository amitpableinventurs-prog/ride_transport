"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSmsProvider = getSmsProvider;
const env_1 = require("../config/env");
// Development provider: prints the message instead of sending it.
// Real providers are selected with SMS_PROVIDER (console, twilio).
const consoleProvider = {
    name: 'console',
    async send(to, message) {
        console.log(`[sms:console] to ${to}: ${message}`);
    },
};
// Twilio Messages API: https://www.twilio.com/docs/messaging/api/message-resource
const twilioProvider = {
    name: 'twilio',
    async send(to, message) {
        const { twilioAccountSid: accountSid, twilioAuthToken, twilioApiKeySid, twilioApiKeySecret, twilioFrom, twilioMessagingServiceSid } = env_1.env;
        const user = twilioApiKeySid || accountSid;
        const secret = twilioApiKeySid ? twilioApiKeySecret : twilioAuthToken;
        if (!accountSid || !user || !secret || (!twilioFrom && !twilioMessagingServiceSid)) {
            throw new Error('Twilio is not configured: set TWILIO_ACCOUNT_SID, an auth token (or API key SID + secret) and TWILIO_FROM or TWILIO_MESSAGING_SERVICE_SID');
        }
        const body = new URLSearchParams({ To: to, Body: message });
        if (twilioMessagingServiceSid)
            body.set('MessagingServiceSid', twilioMessagingServiceSid);
        else
            body.set('From', twilioFrom);
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
            method: 'POST',
            headers: { Authorization: `Basic ${Buffer.from(`${user}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        });
        if (!response.ok) {
            // Twilio error bodies hold a code and message, never our credentials.
            console.error('[sms:twilio] send failed', response.status, await response.text());
            throw new Error('Could not send the SMS');
        }
    },
};
const providers = {
    console: consoleProvider,
    twilio: twilioProvider,
};
function getSmsProvider() {
    const provider = providers[env_1.env.smsProvider];
    if (!provider) {
        throw new Error(`Unknown SMS_PROVIDER "${env_1.env.smsProvider}". Available: ${Object.keys(providers).join(', ')}`);
    }
    if (provider === consoleProvider && env_1.env.isProduction) {
        console.warn('[sms] SMS_PROVIDER=console in production: OTPs are only printed to the log, not delivered.');
    }
    return provider;
}
//# sourceMappingURL=sms.js.map