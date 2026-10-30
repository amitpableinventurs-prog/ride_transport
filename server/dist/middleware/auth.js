"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requirePermission = requirePermission;
const Admin_1 = require("../models/Admin");
const Role_1 = require("../models/Role");
const jwt_1 = require("../utils/jwt");
const sessions_1 = require("../utils/sessions");
async function requireAuth(req, res, next) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = token ? (0, jwt_1.verifyAccessToken)(token) : null;
    if (!payload || (await (0, sessions_1.isSessionRevoked)(payload.fid))) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const admin = await Admin_1.Admin.findById(payload.sub);
    if (!admin || admin.status === 'suspended') {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    const role = await Role_1.Role.findOne({ key: admin.role });
    req.admin = admin;
    req.adminSessionId = payload.fid;
    req.adminPermissions = role?.permissions ?? [];
    next();
}
function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.adminPermissions?.includes(permission)) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map