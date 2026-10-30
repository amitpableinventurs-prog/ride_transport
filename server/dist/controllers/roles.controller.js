"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRoles = listRoles;
exports.updateRolePermissions = updateRolePermissions;
const Role_1 = require("../models/Role");
const audit_1 = require("../utils/audit");
async function listRoles(_req, res) {
    const roles = await Role_1.Role.find().sort({ createdAt: 1 });
    res.json(roles);
}
async function updateRolePermissions(req, res) {
    const key = req.params.key;
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
        res.status(400).json({ message: 'permissions must be an array' });
        return;
    }
    const role = await Role_1.Role.findOneAndUpdate({ key }, { permissions }, { new: true });
    if (!role) {
        res.status(404).json({ message: 'Role not found' });
        return;
    }
    await (0, audit_1.recordAudit)(req.admin, 'role.permissions_updated', 'Role', role.name, { permissionCount: permissions.length });
    res.json(role);
}
//# sourceMappingURL=roles.controller.js.map