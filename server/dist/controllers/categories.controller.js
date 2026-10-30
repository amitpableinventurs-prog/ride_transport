"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCategories = listCategories;
exports.createCategory = createCategory;
exports.updateCategory = updateCategory;
exports.deleteCategory = deleteCategory;
const ServiceCategory_1 = require("../models/ServiceCategory");
const audit_1 = require("../utils/audit");
async function listCategories(req, res) {
    const { mode } = req.query;
    const filter = {};
    if (mode)
        filter.mode = mode;
    const categories = await ServiceCategory_1.ServiceCategory.find(filter).sort({ sortOrder: 1, name: 1 }).populate('vehicleType', 'name capacityLabel');
    res.json(categories);
}
async function createCategory(req, res) {
    const { mode, key, name, description, icon, seats, capacityLabel, vehicleType, status, sortOrder } = req.body;
    if (!mode || !key || !name) {
        res.status(400).json({ message: 'mode, key and name are required' });
        return;
    }
    const existing = await ServiceCategory_1.ServiceCategory.findOne({ key: key.trim() });
    if (existing) {
        res.status(409).json({ message: 'A category with this key already exists' });
        return;
    }
    const category = await ServiceCategory_1.ServiceCategory.create({
        mode,
        key: key.trim(),
        name,
        description,
        icon,
        seats,
        capacityLabel,
        vehicleType: vehicleType || null,
        status,
        sortOrder,
    });
    await (0, audit_1.recordAudit)(req.admin, 'category.created', 'ServiceCategory', `${category.name} (${category.key})`);
    res.status(201).json(category);
}
async function updateCategory(req, res) {
    const category = await ServiceCategory_1.ServiceCategory.findById(req.params.id);
    if (!category) {
        res.status(404).json({ message: 'Category not found' });
        return;
    }
    const body = req.body;
    if (body.name !== undefined)
        category.name = body.name;
    if (body.description !== undefined)
        category.description = body.description;
    if (body.icon !== undefined)
        category.icon = body.icon;
    if (body.seats !== undefined)
        category.seats = body.seats;
    if (body.capacityLabel !== undefined)
        category.capacityLabel = body.capacityLabel;
    if (body.vehicleType !== undefined)
        category.vehicleType = body.vehicleType;
    if (body.status !== undefined)
        category.status = body.status;
    if (body.sortOrder !== undefined)
        category.sortOrder = body.sortOrder;
    await category.save();
    await (0, audit_1.recordAudit)(req.admin, 'category.updated', 'ServiceCategory', `${category.name} (${category.key})`);
    res.json(category);
}
async function deleteCategory(req, res) {
    const category = await ServiceCategory_1.ServiceCategory.findById(req.params.id);
    if (!category) {
        res.status(404).json({ message: 'Category not found' });
        return;
    }
    await category.deleteOne();
    await (0, audit_1.recordAudit)(req.admin, 'category.deleted', 'ServiceCategory', `${category.name} (${category.key})`);
    res.status(204).send();
}
//# sourceMappingURL=categories.controller.js.map