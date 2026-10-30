"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayWebhook = razorpayWebhook;
const gatewayPayments_1 = require("../services/gatewayPayments");
// POST /api/v1/webhooks/razorpay: raw JSON body + X-Razorpay-Signature. A non-2xx reply makes Razorpay retry.
async function razorpayWebhook(req, res) {
    const signature = req.header('x-razorpay-signature') ?? '';
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    res.json(await (0, gatewayPayments_1.handleRazorpayWebhook)(rawBody, signature));
}
//# sourceMappingURL=webhooks.controller.js.map