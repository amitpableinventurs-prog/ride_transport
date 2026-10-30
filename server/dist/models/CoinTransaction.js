"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoinTransaction = void 0;
const mongoose_1 = require("mongoose");
// anzcabs Coins ledger for customers. The balance lives on Customer.coins; every change is recorded here.
// Earning and spending rules are not decided yet, so nothing writes coins automatically.
const coinTransactionSchema = new mongoose_1.Schema({
    customer: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true },
    // wrapped as `{ type: String }`: a field literally named "type" must be wrapped for Mongoose.
    type: { type: String, enum: ['credit', 'debit'], required: true },
    coins: { type: Number, required: true },
    reason: { type: String, enum: ['ride', 'referral', 'bonus', 'redeemed', 'expired', 'adjustment'], required: true },
    note: { type: String },
    booking: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', default: null },
    balanceAfter: { type: Number, required: true },
}, { timestamps: true });
coinTransactionSchema.index({ customer: 1, createdAt: -1 });
exports.CoinTransaction = (0, mongoose_1.model)('CoinTransaction', coinTransactionSchema);
//# sourceMappingURL=CoinTransaction.js.map