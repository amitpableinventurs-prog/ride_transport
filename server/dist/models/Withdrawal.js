"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Withdrawal = void 0;
const mongoose_1 = require("mongoose");
// Rider payouts
const withdrawalSchema = new mongoose_1.Schema({
    driver: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    wallet: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Wallet', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['bank', 'upi'], required: true },
    upiId: { type: String },
    bankAccount: {
        holderName: String,
        accountNumber: String,
        ifsc: String,
    },
    status: { type: String, enum: ['requested', 'processing', 'paid', 'rejected'], default: 'requested' },
    reference: { type: String },
    rejectionReason: { type: String },
    processedAt: { type: Date },
}, { timestamps: true });
exports.Withdrawal = (0, mongoose_1.model)('Withdrawal', withdrawalSchema);
//# sourceMappingURL=Withdrawal.js.map