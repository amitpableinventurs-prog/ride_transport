"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSosRequests = listSosRequests;
exports.updateSosRequest = updateSosRequest;
const SosRequest_1 = require("../models/SosRequest");
const audit_1 = require("../utils/audit");
async function listSosRequests(_req, res) {
    const requests = await SosRequest_1.SosRequest.find().sort({ createdAt: -1 }).populate('booking', 'bookingCode mode status');
    res.json(requests);
}
async function updateSosRequest(req, res) {
    const { status, note } = req.body;
    const sos = await SosRequest_1.SosRequest.findById(req.params.id);
    if (!sos) {
        res.status(404).json({ message: 'SOS request not found' });
        return;
    }
    if (status)
        sos.status = status;
    if (note) {
        sos.notes.push({ by: req.admin.name, text: note, at: new Date() });
    }
    if (status === 'resolved') {
        sos.resolvedAt = new Date();
    }
    await sos.save();
    if (status === 'resolved') {
        await (0, audit_1.recordAudit)(req.admin, 'sos.status_changed', 'SosRequest', `${sos.userName} (${sos.raisedBy})`, { status, note });
    }
    res.json(sos);
}
//# sourceMappingURL=sos.controller.js.map