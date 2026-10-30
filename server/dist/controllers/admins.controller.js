"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listAdmins = listAdmins;
exports.createAdmin = createAdmin;
exports.updateAdmin = updateAdmin;
const Admin_1 = require("../models/Admin");
const password_1 = require("../utils/password");
const audit_1 = require("../utils/audit");
const env_1 = require("../config/env");
async function listAdmins(_req, res) {
    const admins = await Admin_1.Admin.find().select('-passwordHash').sort({ createdAt: 1 });
    res.json(admins);
}
async function createAdmin(req, res) {
    const { name, email, phone, role } = req.body;
    if (!name || !email || !phone || !role) {
        res.status(400).json({ message: 'name, email, phone and role are required' });
        return;
    }
    const existing = await Admin_1.Admin.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
        res.status(409).json({ message: 'An admin with this email already exists' });
        return;
    }
    const passwordHash = await (0, password_1.hashPassword)(env_1.env.seedAdminPassword);
    const admin = await Admin_1.Admin.create({ name, email: email.trim().toLowerCase(), phone, role, passwordHash });
    await (0, audit_1.recordAudit)(req.admin, 'admin.create', 'AdminUser', `${admin.name} (${admin.email})`);
    const { passwordHash: _omit, ...safe } = admin.toJSON();
    res.status(201).json(safe);
}
async function updateAdmin(req, res) {
    const target = await Admin_1.Admin.findById(req.params.id);
    if (!target) {
        res.status(404).json({ message: 'Admin not found' });
        return;
    }
    const body = req.body;
    if (target.id === req.admin.id && target.role === 'super_admin') {
        if (body.status === 'suspended' || (body.role && body.role !== 'super_admin')) {
            res.status(400).json({ message: 'You cannot suspend or demote your own Super Admin account' });
            return;
        }
    }
    if (body.name !== undefined)
        target.name = body.name;
    if (body.phone !== undefined)
        target.phone = body.phone;
    if (body.role !== undefined)
        target.role = body.role;
    if (body.status !== undefined)
        target.status = body.status;
    await target.save();
    await (0, audit_1.recordAudit)(req.admin, body.status ? 'admin.status_changed' : 'admin.updated', 'AdminUser', `${target.name} (${target.email})`, body.status ? { status: body.status } : undefined);
    const { passwordHash: _omit, ...safe } = target.toJSON();
    res.json(safe);
}
//# sourceMappingURL=admins.controller.js.map