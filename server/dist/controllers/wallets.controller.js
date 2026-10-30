"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWallets = listWallets;
exports.getWalletTransactions = getWalletTransactions;
exports.adjustWallet = adjustWallet;
const Wallet_1 = require("../models/Wallet");
const WalletTransaction_1 = require("../models/WalletTransaction");
const Customer_1 = require("../models/Customer");
const Driver_1 = require("../models/Driver");
const TransportPartner_1 = require("../models/TransportPartner");
const audit_1 = require("../utils/audit");
const WALLET_REASONS = ['booking_earning', 'commission', 'recharge', 'refund', 'penalty', 'bonus', 'withdrawal', 'adjustment'];
async function resolveOwnerName(ownerType, ownerId) {
    if (ownerType === 'customer') {
        const customer = await Customer_1.Customer.findById(ownerId).select('name');
        return customer?.name ?? 'Unknown customer';
    }
    if (ownerType === 'driver') {
        const driver = await Driver_1.Driver.findById(ownerId).select('name');
        return driver?.name ?? 'Unknown driver';
    }
    const partner = await TransportPartner_1.TransportPartner.findById(ownerId).select('companyName');
    return partner?.companyName ?? 'Unknown partner';
}
function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
    return { page, pageSize };
}
async function listWallets(req, res) {
    const query = req.query;
    const { ownerType } = query;
    const filter = {};
    if (ownerType)
        filter.ownerType = ownerType;
    const { page, pageSize } = parsePagination(query);
    const [wallets, total] = await Promise.all([
        Wallet_1.Wallet.find(filter)
            .sort({ updatedAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize),
        Wallet_1.Wallet.countDocuments(filter),
    ]);
    const items = await Promise.all(wallets.map(async (wallet) => ({
        ...wallet.toJSON(),
        ownerName: await resolveOwnerName(wallet.ownerType, wallet.ownerId),
    })));
    res.json({ items, total, page, pageSize });
}
async function getWalletTransactions(req, res) {
    const wallet = await Wallet_1.Wallet.findById(req.params.id);
    if (!wallet) {
        res.status(404).json({ message: 'Wallet not found' });
        return;
    }
    const transactions = await WalletTransaction_1.WalletTransaction.find({ wallet: wallet._id }).sort({ createdAt: -1 });
    res.json(transactions);
}
async function adjustWallet(req, res) {
    const wallet = await Wallet_1.Wallet.findById(req.params.id);
    if (!wallet) {
        res.status(404).json({ message: 'Wallet not found' });
        return;
    }
    const { type, amount, reason } = req.body;
    if (type !== 'credit' && type !== 'debit') {
        res.status(400).json({ message: 'type must be credit or debit' });
        return;
    }
    if (!amount || amount <= 0) {
        res.status(400).json({ message: 'amount must be a positive number' });
        return;
    }
    const resolvedReason = WALLET_REASONS.includes(reason ?? '')
        ? reason
        : 'adjustment';
    const delta = type === 'credit' ? amount : -amount;
    const updatedWallet = await Wallet_1.Wallet.findByIdAndUpdate(wallet._id, { $inc: { balance: delta } }, { new: true });
    if (!updatedWallet) {
        res.status(404).json({ message: 'Wallet not found' });
        return;
    }
    const transaction = await WalletTransaction_1.WalletTransaction.create({
        wallet: wallet._id,
        type,
        amount,
        reason: resolvedReason,
        referenceType: 'manual_adjustment',
        balanceAfter: updatedWallet.balance,
        createdBy: req.admin._id,
    });
    await (0, audit_1.recordAudit)(req.admin, 'wallet.adjusted', 'Wallet', `${wallet.ownerType}:${wallet.ownerId}`, {
        type,
        amount,
        reason: resolvedReason,
    });
    res.json({ wallet: updatedWallet, transaction });
}
//# sourceMappingURL=wallets.controller.js.map