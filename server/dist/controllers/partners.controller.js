"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPartners = listPartners;
exports.updatePartner = updatePartner;
const TransportPartner_1 = require("../models/TransportPartner");
const audit_1 = require("../utils/audit");
const regex_1 = require("../utils/regex");
function parsePagination(req) {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}
async function listPartners(req, res) {
    const { page, limit, skip } = parsePagination(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const approvalStatus = typeof req.query.approvalStatus === 'string' ? req.query.approvalStatus : undefined;
    const filter = {};
    if (status)
        filter.status = status;
    if (approvalStatus)
        filter.approvalStatus = approvalStatus;
    if (q) {
        const re = new RegExp((0, regex_1.searchRegex)(q), 'i');
        filter.$or = [{ companyName: re }, { ownerName: re }, { email: re }, { phone: re }];
    }
    const [items, total] = await Promise.all([
        TransportPartner_1.TransportPartner.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        TransportPartner_1.TransportPartner.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
}
async function updatePartner(req, res) {
    const partner = await TransportPartner_1.TransportPartner.findById(req.params.id);
    if (!partner) {
        res.status(404).json({ message: 'Transport partner not found' });
        return;
    }
    const body = req.body;
    if (body.approvalStatus !== undefined)
        partner.approvalStatus = body.approvalStatus;
    if (body.status !== undefined)
        partner.status = body.status;
    await partner.save();
    const action = body.approvalStatus ? 'partner.approval_changed' : 'partner.status_changed';
    await (0, audit_1.recordAudit)(req.admin, action, 'TransportPartner', `${partner.companyName} (${partner.email ?? partner.phone})`, {
        approvalStatus: body.approvalStatus,
        status: body.status,
    });
    res.json(partner);
}
//# sourceMappingURL=partners.controller.js.map