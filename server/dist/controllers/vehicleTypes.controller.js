"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVehicleTypes = listVehicleTypes;
exports.createVehicleType = createVehicleType;
exports.updateVehicleType = updateVehicleType;
exports.deleteVehicleType = deleteVehicleType;
const VehicleType_1 = require("../models/VehicleType");
const Vehicle_1 = require("../models/Vehicle");
const Driver_1 = require("../models/Driver");
const ServiceCategory_1 = require("../models/ServiceCategory");
const audit_1 = require("../utils/audit");
function parsePagination(req) {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
async function listVehicleTypes(req, res) {
    const { page, limit, skip } = parsePagination(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const serviceMode = typeof req.query.serviceMode === 'string' ? req.query.serviceMode : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const filter = {};
    if (serviceMode)
        filter.serviceMode = serviceMode;
    if (status)
        filter.status = status;
    if (q)
        filter.name = new RegExp(escapeRegex(q), 'i');
    const [items, total] = await Promise.all([
        VehicleType_1.VehicleType.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        VehicleType_1.VehicleType.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
}
async function createVehicleType(req, res) {
    const { name, serviceMode, capacityLabel } = req.body;
    if (!name || !serviceMode) {
        res.status(400).json({ message: 'name and serviceMode are required' });
        return;
    }
    const vehicleType = await VehicleType_1.VehicleType.create({ name, serviceMode, capacityLabel });
    await (0, audit_1.recordAudit)(req.admin, 'vehicle_type.create', 'VehicleType', vehicleType.name);
    res.status(201).json(vehicleType);
}
async function updateVehicleType(req, res) {
    const vehicleType = await VehicleType_1.VehicleType.findById(req.params.id);
    if (!vehicleType) {
        res.status(404).json({ message: 'Vehicle type not found' });
        return;
    }
    const body = req.body;
    if (body.name !== undefined)
        vehicleType.name = body.name;
    if (body.serviceMode !== undefined)
        vehicleType.serviceMode = body.serviceMode;
    if (body.capacityLabel !== undefined)
        vehicleType.capacityLabel = body.capacityLabel;
    if (body.status !== undefined)
        vehicleType.status = body.status;
    await vehicleType.save();
    await (0, audit_1.recordAudit)(req.admin, body.status ? 'vehicle_type.status_changed' : 'vehicle_type.updated', 'VehicleType', vehicleType.name, body.status ? { status: body.status } : undefined);
    res.json(vehicleType);
}
// A type that vehicles, riders or service categories still point at cannot be removed; deactivate it instead.
async function deleteVehicleType(req, res) {
    const vehicleType = await VehicleType_1.VehicleType.findById(req.params.id);
    if (!vehicleType) {
        res.status(404).json({ message: 'Vehicle type not found' });
        return;
    }
    const [vehicles, riders, categories] = await Promise.all([
        Vehicle_1.Vehicle.countDocuments({ vehicleType: vehicleType._id }),
        Driver_1.Driver.countDocuments({ 'onboarding.vehicleType': vehicleType._id }),
        ServiceCategory_1.ServiceCategory.countDocuments({ vehicleType: vehicleType._id }),
    ]);
    const used = [
        vehicles && `${vehicles} vehicle${vehicles > 1 ? 's' : ''}`,
        riders && `${riders} rider${riders > 1 ? 's' : ''}/driver${riders > 1 ? 's' : ''}`,
        categories && `${categories} service categor${categories > 1 ? 'ies' : 'y'}`,
    ].filter(Boolean);
    if (used.length) {
        res.status(409).json({
            message: `Cannot delete "${vehicleType.name}": it is used by ${used.join(', ')}. Move them to another vehicle type first${vehicleType.status === 'active' ? ', or deactivate it' : ''}.`,
        });
        return;
    }
    await vehicleType.deleteOne();
    await (0, audit_1.recordAudit)(req.admin, 'vehicle_type.deleted', 'VehicleType', vehicleType.name);
    res.json({ message: 'Vehicle type deleted' });
}
//# sourceMappingURL=vehicleTypes.controller.js.map