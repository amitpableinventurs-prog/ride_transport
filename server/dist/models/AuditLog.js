"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLog = void 0;
const mongoose_1 = require("mongoose");
const auditLogSchema = new mongoose_1.Schema({
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetLabel: { type: String, required: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed },
}, { timestamps: { createdAt: true, updatedAt: false } });
exports.AuditLog = (0, mongoose_1.model)('AuditLog', auditLogSchema);
//# sourceMappingURL=AuditLog.js.map