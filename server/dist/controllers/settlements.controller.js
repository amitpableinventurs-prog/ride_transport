"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSettlements = listSettlements;
exports.markSettlementPaid = markSettlementPaid;
const Settlement_1 = require("../models/Settlement");
const Driver_1 = require("../models/Driver");
const TransportPartner_1 = require("../models/TransportPartner");
const audit_1 = require("../utils/audit");
async function resolvePayeeName(payeeType, payeeId) {
    if (payeeType === 'driver') {
        const driver = await Driver_1.Driver.findById(payeeId).select('name');
        return driver?.name ?? 'Unknown driver';
    }
    const partner = await TransportPartner_1.TransportPartner.findById(payeeId).select('companyName');
    return partner?.companyName ?? 'Unknown partner';
}
function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
    return { page, pageSize };
}
async function listSettlements(req, res) {
    const query = req.query;
    const { payeeType, status } = query;
    const filter = {};
    if (payeeType)
        filter.payeeType = payeeType;
    if (status)
        filter.status = status;
    const { page, pageSize } = parsePagination(query);
    const [settlements, total] = await Promise.all([
        Settlement_1.Settlement.find(filter)
            .sort({ periodEnd: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize),
        Settlement_1.Settlement.countDocuments(filter),
    ]);
    const items = await Promise.all(settlements.map(async (settlement) => ({
        ...settlement.toJSON(),
        payeeName: await resolvePayeeName(settlement.payeeType, settlement.payeeId),
    })));
    res.json({ items, total, page, pageSize });
}
async function markSettlementPaid(req, res) {
    const settlement = await Settlement_1.Settlement.findById(req.params.id);
    if (!settlement) {
        res.status(404).json({ message: 'Settlement not found' });
        return;
    }
    if (settlement.status === 'paid') {
        res.status(400).json({ message: 'Settlement is already marked as paid' });
        return;
    }
    settlement.status = 'paid';
    settlement.paidAt = new Date();
    await settlement.save();
    await (0, audit_1.recordAudit)(req.admin, 'settlement.paid', 'Settlement', `${settlement.payeeType}:${settlement.payeeId}`, {
        netPayable: settlement.netPayable,
    });
    res.json(settlement);
}
//# sourceMappingURL=settlements.controller.js.map