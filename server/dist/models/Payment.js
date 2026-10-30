"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Payment = void 0;
const mongoose_1 = require("mongoose");
const paymentSchema = new mongoose_1.Schema({
    booking: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'upi', 'card', 'netbanking', 'wallet'], required: true },
    gateway: { type: String, enum: ['razorpay', 'stripe', 'cash', 'internal'], default: 'internal' },
    gatewayRefId: { type: String },
    status: { type: String, enum: ['initiated', 'success', 'failed', 'refunded'], default: 'initiated' },
    // Total sent back to the customer's bank / card through the gateway.
    refundedAmount: { type: Number, default: 0 },
}, { timestamps: true });
exports.Payment = (0, mongoose_1.model)('Payment', paymentSchema);
//# sourceMappingURL=Payment.js.map