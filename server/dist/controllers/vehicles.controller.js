"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listVehicles = listVehicles;
exports.createVehicle = createVehicle;
exports.updateVehicle = updateVehicle;
exports.assignVehicleDriver = assignVehicleDriver;
const mongoose_1 = require("mongoose");
const Vehicle_1 = require("../models/Vehicle");
const Driver_1 = require("../models/Driver");
const TransportPartner_1 = require("../models/TransportPartner");
const audit_1 = require("../utils/audit");
function parsePagination(req) {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
async function ownerLabelFor(ownerModel, ownerId) {
    if (ownerModel === 'Driver') {
        const driver = await Driver_1.Driver.findById(ownerId).select('name');
        return driver?.name ?? 'Unknown driver';
    }
    const partner = await TransportPartner_1.TransportPartner.findById(ownerId).select('companyName');
    return partner?.companyName ?? 'Unknown partner';
}
async function listVehicles(req, res) {
    const { page, limit, skip } = parsePagination(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const serviceMode = typeof req.query.serviceMode === 'string' ? req.query.serviceMode : undefined;
    const ownerType = typeof req.query.ownerType === 'string' ? req.query.ownerType : undefined;
    const filter = {};
    if (status)
        filter.status = status;
    if (serviceMode)
        filter.serviceMode = serviceMode;
    if (ownerType)
        filter.ownerType = ownerType;
    if (q) {
        const re = new RegExp(escapeRegex(q), 'i');
        filter.$or = [{ registrationNumber: re }, { model: re }, { manufacturer: re }];
    }
    const [vehicles, total] = await Promise.all([
        Vehicle_1.Vehicle.find(filter).populate('vehicleType', 'name serviceMode capacityLabel').sort({ createdAt: -1 }).skip(skip).limit(limit),
        Vehicle_1.Vehicle.countDocuments(filter),
    ]);
    // Driver currently matched to each vehicle (Driver.assignedVehicle), fetched in one query.
    const assigned = await Driver_1.Driver.find({ assignedVehicle: { $in: vehicles.map((v) => v._id) } }).select('name phone assignedVehicle');
    const driverByVehicle = new Map(assigned.map((d) => [String(d.assignedVehicle), { id: d.id, name: d.name, phone: d.phone }]));
    const items = await Promise.all(vehicles.map(async (vehicle) => {
        const ownerLabel = await ownerLabelFor(vehicle.ownerModel, vehicle.ownerId);
        return { ...vehicle.toJSON(), ownerLabel, assignedDriver: driverByVehicle.get(String(vehicle._id)) ?? null };
    }));
    res.json({ items, total, page, limit });
}
async function createVehicle(req, res) {
    const body = req.body;
    const { registrationNumber, model, vehicleType, serviceMode, categoryKey, ownerType, ownerId } = body;
    if (!registrationNumber || !model || !vehicleType || !serviceMode || !categoryKey || !ownerType || !ownerId) {
        res.status(400).json({
            message: 'registrationNumber, model, vehicleType, serviceMode, categoryKey, ownerType and ownerId are required',
        });
        return;
    }
    const normalizedReg = registrationNumber.trim().toUpperCase();
    const existing = await Vehicle_1.Vehicle.findOne({ registrationNumber: normalizedReg });
    if (existing) {
        res.status(409).json({ message: 'A vehicle with this registration number already exists' });
        return;
    }
    const ownerModel = ownerType === 'driver' ? 'Driver' : 'TransportPartner';
    const vehicle = await Vehicle_1.Vehicle.create({
        registrationNumber: normalizedReg,
        model,
        manufacturer: body.manufacturer,
        vehicleType: new mongoose_1.Types.ObjectId(vehicleType),
        serviceMode,
        categoryKey,
        ownerType,
        ownerId: new mongoose_1.Types.ObjectId(ownerId),
        ownerModel,
        capacity: body.capacity,
    });
    await (0, audit_1.recordAudit)(req.admin, 'vehicle.create', 'Vehicle', vehicle.registrationNumber);
    res.status(201).json(vehicle);
}
async function updateVehicle(req, res) {
    const vehicle = await Vehicle_1.Vehicle.findById(req.params.id);
    if (!vehicle) {
        res.status(404).json({ message: 'Vehicle not found' });
        return;
    }
    const body = req.body;
    // `model` collides with Mongoose's Document#model() method name, so the
    // schema path must be set via .set() rather than direct property assignment.
    if (body.model !== undefined)
        vehicle.set('model', body.model);
    if (body.manufacturer !== undefined)
        vehicle.manufacturer = body.manufacturer;
    if (body.vehicleType !== undefined)
        vehicle.vehicleType = new mongoose_1.Types.ObjectId(body.vehicleType);
    if (body.capacity !== undefined)
        vehicle.capacity = body.capacity;
    if (body.status !== undefined)
        vehicle.status = body.status;
    if (body.documentsStatus !== undefined)
        vehicle.documentsStatus = body.documentsStatus;
    await vehicle.save();
    await (0, audit_1.recordAudit)(req.admin, body.status ? 'vehicle.status_changed' : 'vehicle.updated', 'Vehicle', vehicle.registrationNumber, body.status ? { status: body.status } : undefined);
    res.json(vehicle);
}
// Matches a vehicle with the driver who drives it (or clears the match with driverId: null).
// A vehicle has at most one driver and a driver at most one vehicle.
async function assignVehicleDriver(req, res) {
    const vehicle = await Vehicle_1.Vehicle.findById(req.params.id);
    if (!vehicle) {
        res.status(404).json({ message: 'Vehicle not found' });
        return;
    }
    const { driverId } = req.body;
    if (driverId === undefined || (driverId !== null && !mongoose_1.Types.ObjectId.isValid(driverId))) {
        res.status(400).json({ message: 'driverId must be a driver id, or null to unassign' });
        return;
    }
    if (driverId === null) {
        await Driver_1.Driver.updateMany({ assignedVehicle: vehicle._id }, { $set: { assignedVehicle: null } });
        await (0, audit_1.recordAudit)(req.admin, 'vehicle.driver_unassigned', 'Vehicle', vehicle.registrationNumber);
        res.json({ ...vehicle.toJSON(), assignedDriver: null });
        return;
    }
    const driver = await Driver_1.Driver.findById(driverId);
    if (!driver) {
        res.status(404).json({ message: 'Driver not found' });
        return;
    }
    if (vehicle.status !== 'active') {
        res.status(409).json({ message: 'Only an active vehicle can be assigned' });
        return;
    }
    if (driver.status !== 'active' || driver.approvalStatus !== 'verified') {
        res.status(409).json({ message: 'Only an active, verified driver can be assigned a vehicle' });
        return;
    }
    const partnerId = driver.onboarding?.partner;
    if (vehicle.ownerType === 'partner' && partnerId && String(partnerId) !== String(vehicle.ownerId)) {
        res.status(409).json({ message: 'This driver belongs to a different transport partner' });
        return;
    }
    await Driver_1.Driver.updateMany({ assignedVehicle: vehicle._id, _id: { $ne: driver._id } }, { $set: { assignedVehicle: null } });
    driver.assignedVehicle = vehicle._id;
    await driver.save();
    await (0, audit_1.recordAudit)(req.admin, 'vehicle.driver_assigned', 'Vehicle', vehicle.registrationNumber, {
        driver: `${driver.name} (${driver.phone})`,
    });
    res.json({ ...vehicle.toJSON(), assignedDriver: { id: driver.id, name: driver.name, phone: driver.phone } });
}
//# sourceMappingURL=vehicles.controller.js.map