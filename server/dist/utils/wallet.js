"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debitWallet = exports.creditWallet = void 0;
exports.getOrCreateWallet = getOrCreateWallet;
const Wallet_1 = require("../models/Wallet");
const WalletTransaction_1 = require("../models/WalletTransaction");
const http_1 = require("./http");
async function getOrCreateWallet(ownerType, ownerId) {
    return Wallet_1.Wallet.findOneAndUpdate({ ownerType, ownerId }, { $setOnInsert: { ownerType, ownerId, balance: 0 } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
async function move(type, m) {
    const amount = (0, http_1.roundMoney)(m.amount);
    if (amount <= 0)
        return null;
    const wallet = await getOrCreateWallet(m.ownerType, m.ownerId);
    const delta = type === 'credit' ? amount : -amount;
    // Atomic balance change; a debit without allowNegative only succeeds when the balance covers it.
    const filter = type === 'debit' && !m.allowNegative ? { _id: wallet._id, balance: { $gte: amount } } : { _id: wallet._id };
    const updated = await Wallet_1.Wallet.findOneAndUpdate(filter, { $inc: { balance: delta } }, { new: true });
    if (!updated)
        throw new http_1.HttpError(402, 'Insufficient wallet balance', { balance: wallet.balance, required: amount });
    await WalletTransaction_1.WalletTransaction.create({
        wallet: updated._id,
        type,
        amount,
        reason: m.reason,
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        balanceAfter: (0, http_1.roundMoney)(updated.balance),
    });
    return updated;
}
const creditWallet = (m) => move('credit', m);
exports.creditWallet = creditWallet;
const debitWallet = (m) => move('debit', m);
exports.debitWallet = debitWallet;
//# sourceMappingURL=wallet.js.map