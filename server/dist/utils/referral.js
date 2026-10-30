"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureReferralCode = ensureReferralCode;
exports.awardReferralReward = awardReferralReward;
const Customer_1 = require("../models/Customer");
const settings_1 = require("./settings");
const wallet_1 = require("./wallet");
const CODE_PREFIX = 'RIDE';
/** The customer's own referral code, created on first use. */
async function ensureReferralCode(customerId) {
    const existing = await Customer_1.Customer.findById(customerId).select('referralCode');
    if (existing?.referralCode)
        return existing.referralCode;
    for (let attempt = 0; attempt < 12; attempt++) {
        const digits = attempt < 8 ? 4 : 6;
        const code = CODE_PREFIX + String(Math.floor(Math.random() * 10 ** digits)).padStart(digits, '0');
        try {
            // Only set while still empty so two concurrent calls cannot overwrite each other.
            const updated = await Customer_1.Customer.findOneAndUpdate({ _id: customerId, referralCode: { $exists: false } }, { $set: { referralCode: code } }, { new: true });
            if (updated)
                return code;
            return (await Customer_1.Customer.findById(customerId).select('referralCode')).referralCode;
        }
        catch (err) {
            if (err.code !== 11000)
                throw err; // duplicate code: try another
        }
    }
    throw new Error('Could not generate a referral code');
}
/** Pays both sides once the referred customer completes their first ride. Safe to call after every completed trip. */
async function awardReferralReward(customerId) {
    const settings = await (0, settings_1.getPlatformSettings)();
    if (!settings.referralEnabled)
        return;
    // Atomic claim so a repeated call can never pay twice.
    const customer = await Customer_1.Customer.findOneAndUpdate({ _id: customerId, referredBy: { $ne: null }, referralRewardedAt: { $exists: false } }, { $set: { referralRewardedAt: new Date() } }, { new: true });
    if (!customer?.referredBy)
        return;
    const ref = { reason: 'referral', referenceType: 'Customer' };
    await (0, wallet_1.creditWallet)({ ownerType: 'customer', ownerId: customer.referredBy, amount: settings.referralRewardReferrer, referenceId: customer._id, ...ref });
    await (0, wallet_1.creditWallet)({ ownerType: 'customer', ownerId: customer._id, amount: settings.referralRewardReferee, referenceId: customer.referredBy, ...ref });
}
//# sourceMappingURL=referral.js.map