"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWallet = getWallet;
exports.payDues = payDues;
exports.verifyPayment = verifyPayment;
exports.getPaymentStatus = getPaymentStatus;
exports.requestWithdrawal = requestWithdrawal;
exports.listWithdrawals = listWithdrawals;
const Withdrawal_1 = require("../../models/Withdrawal");
const WalletTransaction_1 = require("../../models/WalletTransaction");
const gatewayPayments_1 = require("../../services/gatewayPayments");
const http_1 = require("../../utils/http");
const settings_1 = require("../../utils/settings");
const wallet_1 = require("../../utils/wallet");
const MAX_WITHDRAWAL = 100_000;
const UPI_RE = /^[\w.-]{2,256}@[a-zA-Z]{2,64}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_RE = /^\d{9,18}$/;
const riderId = (req) => req.appUser.doc._id;
// GET /wallet: a negative balance is commission owed on cash trips (dues).
async function getWallet(req, res) {
    const { page, limit, skip } = (0, http_1.parsePagination)(req);
    const wallet = await (0, wallet_1.getOrCreateWallet)('driver', riderId(req));
    const [transactions, total, settings] = await Promise.all([
        WalletTransaction_1.WalletTransaction.find({ wallet: wallet._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
        WalletTransaction_1.WalletTransaction.countDocuments({ wallet: wallet._id }),
        (0, settings_1.getPlatformSettings)(),
    ]);
    res.json({
        balance: wallet.balance,
        currency: wallet.currency,
        dues: Math.max(0, -wallet.balance),
        duesLimit: settings.maxCashDues,
        duesLimitReached: -wallet.balance > settings.maxCashDues,
        withdrawable: Math.max(0, wallet.balance),
        minWithdrawal: settings.minWithdrawalAmount,
        transactions: { items: transactions, total, page, limit },
    });
}
// POST /wallet/pay-dues: gateway order to clear dues (all of them unless `amount` is sent).
async function payDues(req, res) {
    const wallet = await (0, wallet_1.getOrCreateWallet)('driver', riderId(req));
    const dues = Math.max(0, -wallet.balance);
    if (!dues)
        throw new http_1.HttpError(409, 'You have no dues to pay');
    const body = (req.body ?? {});
    const amount = body.amount === undefined ? dues : (0, http_1.parseAmount)(body.amount, 'amount', { min: 1, max: dues });
    res.status(201).json(await (0, gatewayPayments_1.createGatewayOrder)({ purpose: 'rider_dues', ownerType: 'driver', ownerId: riderId(req), amount }));
}
// POST /payments/verify: confirms a dues payment after the gateway checkout.
async function verifyPayment(req, res) {
    res.json(await (0, gatewayPayments_1.verifyGatewayPayment)({ type: 'driver', id: riderId(req) }, req.body));
}
// GET /payments/orders/:orderId: dues payment status; a paid order is applied even if /payments/verify never came.
async function getPaymentStatus(req, res) {
    res.json(await (0, gatewayPayments_1.getGatewayOrderStatus)({ type: 'driver', id: riderId(req) }, (0, http_1.requireString)(req.params.orderId, 'orderId')));
}
function serializeWithdrawal(w) {
    const json = w.toJSON();
    if (json.bankAccount?.accountNumber)
        json.bankAccount = { ...json.bankAccount, accountNumber: `XXXX${json.bankAccount.accountNumber.slice(-4)}` };
    return json;
}
// POST /withdrawals: the amount is held from the wallet until the payout is processed.
async function requestWithdrawal(req, res) {
    const body = req.body;
    const settings = await (0, settings_1.getPlatformSettings)();
    const amount = (0, http_1.parseAmount)(body.amount, 'amount', { min: 0.01, max: MAX_WITHDRAWAL });
    if (amount < settings.minWithdrawalAmount) {
        throw new http_1.HttpError(400, `Minimum withdrawal is ₹${settings.minWithdrawalAmount}`, { minWithdrawal: settings.minWithdrawalAmount });
    }
    const balance = (await (0, wallet_1.getOrCreateWallet)('driver', riderId(req))).balance;
    if (amount > balance) {
        throw new http_1.HttpError(402, `You can withdraw up to ₹${Math.max(0, balance)}`, { withdrawable: Math.max(0, balance), minWithdrawal: settings.minWithdrawalAmount });
    }
    const method = body.method;
    let payout;
    if (method === 'upi') {
        const upiId = (0, http_1.requireString)(body.upiId, 'upiId', 300);
        if (!UPI_RE.test(upiId))
            throw new http_1.HttpError(400, 'Enter a valid UPI ID, e.g. name@okbank');
        payout = { upiId };
    }
    else if (method === 'bank') {
        const account = (body.bankAccount ?? {});
        const holderName = (0, http_1.requireString)(account.holderName, 'bankAccount.holderName', 100);
        const accountNumber = (0, http_1.requireString)(account.accountNumber, 'bankAccount.accountNumber', 18);
        const ifsc = (0, http_1.requireString)(account.ifsc, 'bankAccount.ifsc', 11).toUpperCase();
        if (!ACCOUNT_RE.test(accountNumber))
            throw new http_1.HttpError(400, 'Enter a valid bank account number');
        if (!IFSC_RE.test(ifsc))
            throw new http_1.HttpError(400, 'Enter a valid IFSC code');
        payout = { bankAccount: { holderName, accountNumber, ifsc } };
    }
    else {
        throw new http_1.HttpError(400, 'method must be bank or upi');
    }
    if (await Withdrawal_1.Withdrawal.exists({ driver: riderId(req), status: { $in: ['requested', 'processing'] } })) {
        throw new http_1.HttpError(409, 'You already have a payout in progress');
    }
    const withdrawal = new Withdrawal_1.Withdrawal({ driver: riderId(req), amount, method, ...payout });
    const wallet = await (0, wallet_1.debitWallet)({ ownerType: 'driver', ownerId: riderId(req), amount, reason: 'withdrawal', referenceType: 'Withdrawal', referenceId: withdrawal._id });
    withdrawal.wallet = wallet._id;
    await withdrawal.save();
    res.status(201).json({ ...serializeWithdrawal(withdrawal), note: 'Payouts are processed within 2 working days.' });
}
// GET /withdrawals
async function listWithdrawals(req, res) {
    const { page, limit, skip } = (0, http_1.parsePagination)(req);
    const filter = { driver: riderId(req) };
    const [items, total] = await Promise.all([Withdrawal_1.Withdrawal.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Withdrawal_1.Withdrawal.countDocuments(filter)]);
    res.json({ items: items.map(serializeWithdrawal), total, page, limit });
}
//# sourceMappingURL=wallet.controller.js.map