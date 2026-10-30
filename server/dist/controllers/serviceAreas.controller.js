"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listServiceAreas = listServiceAreas;
exports.getServiceArea = getServiceArea;
exports.createServiceArea = createServiceArea;
exports.updateServiceArea = updateServiceArea;
exports.deleteServiceArea = deleteServiceArea;
const ServiceArea_1 = require("../models/ServiceArea");
const audit_1 = require("../utils/audit");
const regex_1 = require("../utils/regex");
const MUTABLE_FIELDS = ['name', 'country', 'state', 'city', 'zone', 'status', 'rideEnabled', 'transportEnabled', 'geofence'];
function pickMutableFields(body) {
    const out = {};
    for (const key of MUTABLE_FIELDS) {
        if (body[key] !== undefined)
            out[key] = body[key];
    }
    return out;
}
async function listServiceAreas(req, res) {
    const { status, q } = req.query;
    const filter = {};
    if (status)
        filter.status = status;
    if (q) {
        filter.$or = [
            { name: { $regex: (0, regex_1.searchRegex)(q), $options: 'i' } },
            { city: { $regex: (0, regex_1.searchRegex)(q), $options: 'i' } },
            { state: { $regex: (0, regex_1.searchRegex)(q), $options: 'i' } },
        ];
    }
    const areas = await ServiceArea_1.ServiceArea.find(filter).sort({ createdAt: -1 });
    res.json(areas);
}
async function getServiceArea(req, res) {
    const area = await ServiceArea_1.ServiceArea.findById(req.params.id);
    if (!area) {
        res.status(404).json({ message: 'Service area not found' });
        return;
    }
    res.json(area);
}
async function createServiceArea(req, res) {
    const body = req.body;
    if (!body.name || !body.country || !body.state || !body.city) {
        res.status(400).json({ message: 'name, country, state and city are required' });
        return;
    }
    const area = await ServiceArea_1.ServiceArea.create(pickMutableFields(body));
    await (0, audit_1.recordAudit)(req.admin, 'service_area.create', 'ServiceArea', area.name);
    res.status(201).json(area);
}
async function updateServiceArea(req, res) {
    const area = await ServiceArea_1.ServiceArea.findById(req.params.id);
    if (!area) {
        res.status(404).json({ message: 'Service area not found' });
        return;
    }
    const patch = pickMutableFields(req.body);
    Object.assign(area, patch);
    await area.save();
    await (0, audit_1.recordAudit)(req.admin, 'service_area.updated', 'ServiceArea', area.name, patch.status !== undefined ? { status: patch.status } : undefined);
    res.json(area);
}
async function deleteServiceArea(req, res) {
    const area = await ServiceArea_1.ServiceArea.findById(req.params.id);
    if (!area) {
        res.status(404).json({ message: 'Service area not found' });
        return;
    }
    await area.deleteOne();
    await (0, audit_1.recordAudit)(req.admin, 'service_area.deleted', 'ServiceArea', area.name);
    res.status(204).end();
}
//# sourceMappingURL=serviceAreas.controller.js.map