"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPaymentProvider = getPaymentProvider;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const http_1 = require("./http");
function hmacEquals(secret, payload, signature) {
    const expected = crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && crypto_1.default.timingSafeEqual(a, b);
}
// Development provider: orders are created locally and `signature: "mock_success"` verifies any payment.
const MOCK_SIGNATURE = 'mock_success';
const mockProvider = {
    name: 'mock',
    async createOrder(amountRupees) {
        return { id: `order_mock_${crypto_1.default.randomBytes(8).toString('hex')}`, amount: amountRupees, currency: 'INR' };
    },
    verifySignature(_orderId, _paymentId, signature) {
        return signature === MOCK_SIGNATURE;
    },
    async findCapturedPayment() {
        return null;
    },
    // Pay a mock QR from the customer app: POST /customer/payments/verify with the QR id as orderId and signature "mock_success".
    async createUpiQr(amountRupees, opts) {
        const id = `qr_mock_${crypto_1.default.randomBytes(8).toString('hex')}`;
        const params = new URLSearchParams({ pa: 'anzcabs.mock@upi', pn: 'AnZ Cabs', am: amountRupees.toFixed(2), cu: 'INR', tr: id, tn: opts.description });
        return { id, amount: amountRupees, imageUrl: null, upiUri: `upi://pay?${params.toString()}` };
    },
    async findQrPayment() {
        return null;
    },
    async closeUpiQr() { },
    verifyWebhookSignature() {
        return false;
    },
    async refundPayment() {
        return { id: `rfnd_mock_${crypto_1.default.randomBytes(8).toString('hex')}`, status: 'processed' };
    },
};
function razorpayAuthHeader() {
    return `Basic ${Buffer.from(`${env_1.env.razorpayKeyId}:${env_1.env.razorpayKeySecret}`).toString('base64')}`;
}
// Razorpay Orders API: https://razorpay.com/docs/api/orders/
const razorpayProvider = {
    name: 'razorpay',
    get publicKey() {
        return env_1.env.razorpayKeyId;
    },
    async createOrder(amountRupees, receipt) {
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: { Authorization: razorpayAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: 'INR', receipt }),
        });
        if (!response.ok) {
            console.error('[payments:razorpay] order creation failed', response.status, await response.text());
            throw new http_1.HttpError(502, 'Could not start the payment. Please try again.');
        }
        const order = (await response.json());
        return { id: order.id, amount: order.amount / 100, currency: order.currency };
    },
    verifySignature(orderId, paymentId, signature) {
        return hmacEquals(env_1.env.razorpayKeySecret, `${orderId}|${paymentId}`, signature);
    },
    // https://razorpay.com/docs/api/orders/fetch-payments/
    async findCapturedPayment(orderId) {
        const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, {
            headers: { Authorization: razorpayAuthHeader() },
        });
        if (!response.ok) {
            console.error('[payments:razorpay] fetching order payments failed', orderId, response.status, await response.text());
            throw new http_1.HttpError(502, 'Could not check the payment status. Please try again.');
        }
        const { items = [] } = (await response.json());
        return items.find((p) => p.status === 'captured')?.id ?? null;
    },
    // https://razorpay.com/docs/api/qr-codes/create/ (QR Codes must be enabled on the Razorpay account)
    async createUpiQr(amountRupees, opts) {
        const response = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
            method: 'POST',
            headers: { Authorization: razorpayAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'upi_qr',
                name: 'AnZ Cabs',
                usage: 'single_use',
                fixed_amount: true,
                payment_amount: Math.round(amountRupees * 100),
                description: opts.description,
                close_by: Math.floor(opts.closesAt.getTime() / 1000),
                notes: opts.notes,
            }),
        });
        if (!response.ok) {
            console.error('[payments:razorpay] QR creation failed', response.status, await response.text());
            throw new http_1.HttpError(502, 'Could not create the payment QR. Please try again or collect cash.');
        }
        const qr = (await response.json());
        return { id: qr.id, amount: qr.payment_amount / 100, imageUrl: qr.image_url, upiUri: null };
    },
    // https://razorpay.com/docs/api/qr-codes/fetch-payments/
    async findQrPayment(qrId) {
        const response = await fetch(`https://api.razorpay.com/v1/payments/qr_codes/${encodeURIComponent(qrId)}/payments`, {
            headers: { Authorization: razorpayAuthHeader() },
        });
        if (!response.ok) {
            console.error('[payments:razorpay] fetching QR payments failed', qrId, response.status, await response.text());
            throw new http_1.HttpError(502, 'Could not check the payment status. Please try again.');
        }
        const { items = [] } = (await response.json());
        return items.find((p) => p.status === 'captured')?.id ?? null;
    },
    // https://razorpay.com/docs/api/qr-codes/close/
    async closeUpiQr(qrId) {
        const response = await fetch(`https://api.razorpay.com/v1/payments/qr_codes/${encodeURIComponent(qrId)}/close`, {
            method: 'POST',
            headers: { Authorization: razorpayAuthHeader() },
        });
        // Already closed (paid or past close_by) is fine.
        if (!response.ok)
            console.warn('[payments:razorpay] closing QR failed', qrId, response.status, await response.text());
    },
    // https://razorpay.com/docs/webhooks/validate-test/
    verifyWebhookSignature(rawBody, signature) {
        return Boolean(env_1.env.razorpayWebhookSecret) && hmacEquals(env_1.env.razorpayWebhookSecret, rawBody.toString('utf8'), signature);
    },
    // https://razorpay.com/docs/api/refunds/create-normal/
    async refundPayment(paymentId, amountRupees, receipt) {
        const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
            method: 'POST',
            headers: { Authorization: razorpayAuthHeader(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: Math.round(amountRupees * 100), speed: 'normal', receipt }),
        });
        if (!response.ok) {
            const text = await response.text();
            console.error('[payments:razorpay] refund failed', paymentId, response.status, text);
            let reason = '';
            try {
                reason = JSON.parse(text).error?.description ?? '';
            }
            catch {
                // not JSON
            }
            throw new http_1.HttpError(502, reason ? `Razorpay refused the refund: ${reason}` : 'Could not reach Razorpay for the refund. Please try again.');
        }
        const refund = (await response.json());
        return { id: refund.id, status: refund.status };
    },
};
const providers = { mock: mockProvider, razorpay: razorpayProvider };
function getPaymentProvider() {
    const provider = providers[env_1.env.paymentProvider];
    if (!provider)
        throw new Error(`Unknown PAYMENT_PROVIDER "${env_1.env.paymentProvider}". Available: ${Object.keys(providers).join(', ')}`);
    if (provider === mockProvider && env_1.env.isProduction)
        throw new http_1.HttpError(503, 'Online payments are not configured');
    if (provider === razorpayProvider && (!env_1.env.razorpayKeyId || !env_1.env.razorpayKeySecret)) {
        throw new http_1.HttpError(503, 'Online payments are not configured');
    }
    return provider;
}
//# sourceMappingURL=payments.js.map