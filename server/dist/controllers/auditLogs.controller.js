"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAuditLogs = listAuditLogs;
const AuditLog_1 = require("../models/AuditLog");
async function listAuditLogs(_req, res) {
    const logs = await AuditLog_1.AuditLog.find().sort({ createdAt: -1 }).limit(500);
    res.json(logs);
}
//# sourceMappingURL=auditLogs.controller.js.map