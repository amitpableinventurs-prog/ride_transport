"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listWithdrawals = listWithdrawals;
exports.markWithdrawalProcessing = markWithdrawalProcessing;
exports.markWithdrawalPaid = markWithdrawalPaid;
exports.rejectWithdrawal = rejectWithdrawal;
const Withdrawal_1 = require("../models/Withdrawal");
const audit_1 = require("../utils/audit");
const http_1 = require("../utils/http");
const notify_1 = require("../utils/notify");
const wallet_1 = require("../utils/wallet");
const OPEN_STATUSES = ['requested', 'processing'];
function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
    return { page, pageSize };
}
// GET /withdrawals?status=
async function listWithdrawals(req, res) {
    const query = req.query;
    const filter = {};
    if (query.status)
        filter.status = query.status;
    const { page, pageSize } = parsePagination(query);
    const [items, total] = await Promise.all([
        Withdrawal_1.Withdrawal.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .populate({ path: 'driver', select: 'name phone' }),
        Withdrawal_1.Withdrawal.countDocuments(filter),
    ]);
    res.json({ items, total, page, pageSize });
}
// PATCH /withdrawals/:id/processing: the admin has started the bank / UPI transfer.
async function markWithdrawalProcessing(req, res) {
    const withdrawal = await Withdrawal_1.Withdrawal.findOneAndUpdate({ _id: req.params.id, status: 'requested' }, { $set: { status: 'processing' } }, { new: true });
    if (!withdrawal)
        throw new http_1.HttpError(409, 'Only new requests can be moved to processing');
    await (0, audit_1.recordAudit)(req.admin, 'withdrawal.processing', 'Withdrawal', String(withdrawal._id), { amount: withdrawal.amount });
    res.json(await withdrawal.populate({ path: 'driver', select: 'name phone' }));
}
// PATCH /withdrawals/:id/paid { reference }: the transfer is done; `reference` is the UTR / transaction id.
async function markWithdrawalPaid(req, res) {
    const reference = (0, http_1.requireString)((req.body ?? {}).reference, 'reference', 100);
    const withdrawal = await Withdrawal_1.Withdrawal.findOneAndUpdate({ _id: req.params.id, status: { $in: OPEN_STATUSES } }, { $set: { status: 'paid', reference, processedAt: new Date() } }, { new: true });
    if (!withdrawal)
        throw new http_1.HttpError(409, 'This payout is not open');
    await (0, audit_1.recordAudit)(req.admin, 'withdrawal.paid', 'Withdrawal', String(withdrawal._id), { amount: withdrawal.amount, reference });
    await (0, notify_1.notifyUser)('driver', withdrawal.driver, {
        title: 'Payout sent',
        body: `₹${withdrawal.amount} has been sent to your ${withdrawal.method === 'upi' ? 'UPI ID' : 'bank account'}. Reference: ${reference}`,
        data: { type: 'withdrawal', withdrawalId: withdrawal.id, status: 'paid' },
    });
    res.json(await withdrawal.populate({ path: 'driver', select: 'name phone' }));
}
// PATCH /withdrawals/:id/reject { reason }: the held amount goes back to the rider's wallet.
async function rejectWithdrawal(req, res) {
    const reason = (0, http_1.requireString)((req.body ?? {}).reason, 'reason', 300);
    const withdrawal = await Withdrawal_1.Withdrawal.findOneAndUpdate({ _id: req.params.id, status: { $in: OPEN_STATUSES } }, { $set: { status: 'rejected', rejectionReason: reason, processedAt: new Date() } }, { new: true });
    if (!withdrawal)
        throw new http_1.HttpError(409, 'This payout is not open');
    await (0, wallet_1.creditWallet)({ ownerType: 'driver', ownerId: withdrawal.driver, amount: withdrawal.amount, reason: 'withdrawal', referenceType: 'Withdrawal', referenceId: withdrawal._id });
    await (0, audit_1.recordAudit)(req.admin, 'withdrawal.rejected', 'Withdrawal', String(withdrawal._id), { amount: withdrawal.amount, reason });
    await (0, notify_1.notifyUser)('driver', withdrawal.driver, {
        title: 'Payout request declined',
        body: `₹${withdrawal.amount} is back in your wallet. Reason: ${reason}`,
        data: { type: 'withdrawal', withdrawalId: withdrawal.id, status: 'rejected' },
    });
    res.json(await withdrawal.populate({ path: 'driver', select: 'name phone' }));
}
//# sourceMappingURL=withdrawals.controller.js.map