"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAudit = recordAudit;
const AuditLog_1 = require("../models/AuditLog");
const roles_1 = require("./roles");
async function recordAudit(actor, action, targetType, targetLabel, metadata) {
    await AuditLog_1.AuditLog.create({
        actorId: actor.id,
        actorName: actor.name,
        actorRole: (0, roles_1.roleDisplayName)(actor.role),
        action,
        targetType,
        targetLabel,
        metadata,
    });
}
//# sourceMappingURL=audit.js.map