"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRefunds = listRefunds;
exports.approveRefund = approveRefund;
exports.rejectRefund = rejectRefund;
exports.getRefundBookingInfo = getRefundBookingInfo;
exports.createRefund = createRefund;
exports.processRefund = processRefund;
const Refund_1 = require("../models/Refund");
const refunds_1 = require("../services/refunds");
const audit_1 = require("../utils/audit");
const http_1 = require("../utils/http");
function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
    return { page, pageSize };
}
async function listRefunds(req, res) {
    const query = req.query;
    const { status } = query;
    const filter = {};
    if (status)
        filter.status = status;
    const { page, pageSize } = parsePagination(query);
    const [items, total] = await Promise.all([
        Refund_1.Refund.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .populate({ path: 'booking', select: 'bookingCode' }),
        Refund_1.Refund.countDocuments(filter),
    ]);
    res.json({ items, total, page, pageSize });
}
async function approveRefund(req, res) {
    const refund = await Refund_1.Refund.findById(req.params.id);
    if (!refund) {
        res.status(404).json({ message: 'Refund not found' });
        return;
    }
    if (refund.status !== 'requested') {
        res.status(400).json({ message: 'Only requested refunds can be approved' });
        return;
    }
    refund.status = 'approved';
    refund.approvedBy = req.admin._id;
    await refund.save();
    await (0, audit_1.recordAudit)(req.admin, 'refund.approved', 'Refund', String(refund._id), { amount: refund.amount });
    res.json(refund);
}
async function rejectRefund(req, res) {
    const refund = await Refund_1.Refund.findById(req.params.id);
    if (!refund) {
        res.status(404).json({ message: 'Refund not found' });
        return;
    }
    if (refund.status !== 'requested') {
        res.status(400).json({ message: 'Only requested refunds can be rejected' });
        return;
    }
    const { reason } = req.body;
    refund.status = 'rejected';
    refund.approvedBy = req.admin._id;
    await refund.save();
    await (0, audit_1.recordAudit)(req.admin, 'refund.rejected', 'Refund', String(refund._id), reason ? { reason } : undefined);
    res.json(refund);
}
// GET /refunds/booking-info?bookingCode=: amount left to refund and where it will go.
async function getRefundBookingInfo(req, res) {
    const query = req.query;
    res.json(await (0, refunds_1.getRefundableInfo)({ bookingCode: query.bookingCode, bookingId: query.bookingId }));
}
// POST /refunds: an admin raises a refund for a paid booking; it then goes through approve and process.
async function createRefund(req, res) {
    const body = (req.body ?? {});
    const amount = (0, http_1.parseAmount)(body.amount, 'amount', { min: 1, max: 100_000 });
    const reason = (0, http_1.requireString)(body.reason, 'reason', 300);
    const refund = await (0, refunds_1.createRefund)({ bookingCode: body.bookingCode, bookingId: body.bookingId, amount, reason, requestedBy: req.admin.name || req.admin.email });
    await (0, audit_1.recordAudit)(req.admin, 'refund.created', 'Refund', String(refund._id), { amount });
    res.status(201).json(await refund.populate({ path: 'booking', select: 'bookingCode' }));
}
// PATCH /refunds/:id/process: online payments go back to the bank / card through Razorpay, others to the wallet.
async function processRefund(req, res) {
    const { refund, bookingCode } = await (0, refunds_1.processRefund)(String(req.params.id));
    await (0, audit_1.recordAudit)(req.admin, 'refund.processed', 'Refund', `${bookingCode} - ${refund.amount}`, {
        destination: refund.destination,
        ...(refund.gatewayRefundId ? { gatewayRefundId: refund.gatewayRefundId } : {}),
    });
    res.json(await refund.populate({ path: 'booking', select: 'bookingCode' }));
}
//# sourceMappingURL=refunds.controller.js.map