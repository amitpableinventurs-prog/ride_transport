"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayOrder = void 0;
const mongoose_1 = require("mongoose");
// Payment gateway orders (booking payment, wallet top-up, rider dues)
const gatewayOrderSchema = new mongoose_1.Schema({
    purpose: { type: String, enum: ['booking', 'wallet_topup', 'rider_dues'], required: true },
    // checkout: paid in the app with the gateway SDK; upi_qr: a QR the rider shows (providerOrderId is the QR id).
    channel: { type: String, enum: ['checkout', 'upi_qr'], default: 'checkout' },
    ownerType: { type: String, enum: ['customer', 'driver'], required: true },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    booking: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    provider: { type: String, required: true },
    providerOrderId: { type: String, required: true, unique: true },
    providerPaymentId: { type: String },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    paidAt: { type: Date },
    // upi_qr only
    qrImageUrl: { type: String, default: null },
    qrUpiUri: { type: String, default: null },
    closesAt: { type: Date, default: null },
    // Last time the reconciler asked the gateway about this unpaid order.
    lastCheckedAt: { type: Date },
}, { timestamps: true });
exports.GatewayOrder = (0, mongoose_1.model)('GatewayOrder', gatewayOrderSchema);
//# sourceMappingURL=GatewayOrder.js.map