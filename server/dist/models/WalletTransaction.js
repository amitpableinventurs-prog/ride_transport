"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletTransaction = void 0;
const mongoose_1 = require("mongoose");
const walletTransactionSchema = new mongoose_1.Schema({
    wallet: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Wallet', required: true },
    // wrapped as `{ type: String }` — see CommissionRule.ts for why a field
    // literally named "type" must be wrapped for Mongoose.
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true },
    reason: {
        type: String,
        enum: ['booking_earning', 'booking_payment', 'tip', 'commission', 'recharge', 'refund', 'penalty', 'bonus', 'referral', 'withdrawal', 'adjustment'],
        required: true,
    },
    referenceType: { type: String },
    referenceId: { type: mongoose_1.Schema.Types.ObjectId },
    balanceAfter: { type: Number, required: true },
    createdBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Admin', default: null },
}, { timestamps: true });
walletTransactionSchema.index({ wallet: 1, createdAt: -1 });
exports.WalletTransaction = (0, mongoose_1.model)('WalletTransaction', walletTransactionSchema);
//# sourceMappingURL=WalletTransaction.js.map