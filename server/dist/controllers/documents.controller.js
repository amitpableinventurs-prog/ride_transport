"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDocuments = listDocuments;
exports.createDocument = createDocument;
exports.updateDocumentStatus = updateDocumentStatus;
const mongoose_1 = require("mongoose");
const Document_1 = require("../models/Document");
const Vehicle_1 = require("../models/Vehicle");
const audit_1 = require("../utils/audit");
function parsePagination(req) {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}
async function listDocuments(req, res) {
    const { page, limit, skip } = parsePagination(req);
    const ownerType = typeof req.query.ownerType === 'string' ? req.query.ownerType : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const ownerId = typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined;
    const docType = typeof req.query.docType === 'string' ? req.query.docType : undefined;
    const filter = {};
    if (ownerType)
        filter.ownerType = ownerType;
    if (status)
        filter.status = status;
    if (docType)
        filter.docType = docType;
    if (ownerId) {
        if (!mongoose_1.Types.ObjectId.isValid(ownerId)) {
            res.status(400).json({ message: 'ownerId is not a valid id' });
            return;
        }
        filter.ownerId = new mongoose_1.Types.ObjectId(ownerId);
    }
    const [items, total] = await Promise.all([
        Document_1.DocumentRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Document_1.DocumentRecord.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
}
async function createDocument(req, res) {
    const body = req.body;
    if (!body.ownerType || !body.ownerId || !body.docType || !body.fileUrl) {
        res.status(400).json({ message: 'ownerType, ownerId, docType and fileUrl are required' });
        return;
    }
    const doc = await Document_1.DocumentRecord.create({
        ownerType: body.ownerType,
        ownerId: new mongoose_1.Types.ObjectId(body.ownerId),
        docType: body.docType,
        fileUrl: body.fileUrl,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
    });
    await (0, audit_1.recordAudit)(req.admin, 'document.create', 'DocumentRecord', `${doc.docType} (${doc.ownerType})`);
    res.status(201).json(doc);
}
async function updateDocumentStatus(req, res) {
    const doc = await Document_1.DocumentRecord.findById(req.params.id);
    if (!doc) {
        res.status(404).json({ message: 'Document not found' });
        return;
    }
    const { status, rejectionReason } = req.body;
    if (!status || !['pending', 'verified', 'rejected', 'expired'].includes(status)) {
        res.status(400).json({ message: 'A valid status is required' });
        return;
    }
    if (status === 'rejected' && !rejectionReason) {
        res.status(400).json({ message: 'A rejection reason is required when rejecting a document' });
        return;
    }
    doc.status = status;
    doc.rejectionReason = status === 'rejected' ? rejectionReason : undefined;
    doc.reviewedBy = req.admin._id;
    doc.reviewedAt = new Date();
    await doc.save();
    // Keep the vehicle's documentsStatus in step with its RC (the rider app files the RC under the driver).
    // There is no separate vehicle approval: a verified RC puts the vehicle in service, and a rejected or
    // expired RC takes it out. Vehicles an admin blocked stay blocked.
    let vehicleStatus;
    if (doc.ownerType === 'vehicle' || doc.docType === 'vehicle_rc') {
        const vehicle = doc.ownerType === 'vehicle'
            ? await Vehicle_1.Vehicle.findById(doc.ownerId)
            : await Vehicle_1.Vehicle.findOne({ ownerType: 'driver', ownerId: doc.ownerId }).sort({ createdAt: -1 });
        if (vehicle) {
            vehicle.documentsStatus = status;
            if (doc.docType === 'vehicle_rc' && vehicle.status !== 'blocked') {
                if (status === 'verified')
                    vehicle.status = 'active';
                else if (status === 'rejected' || status === 'expired')
                    vehicle.status = 'inactive';
            }
            if (vehicle.isModified('status'))
                vehicleStatus = vehicle.status;
            await vehicle.save();
        }
    }
    await (0, audit_1.recordAudit)(req.admin, 'document.status_changed', 'DocumentRecord', `${doc.docType} (${doc.ownerType})`, {
        status,
        rejectionReason,
        ...(vehicleStatus ? { vehicleStatus } : {}),
    });
    res.json(doc);
}
//# sourceMappingURL=documents.controller.js.map