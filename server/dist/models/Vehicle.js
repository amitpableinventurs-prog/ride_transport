"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Vehicle = void 0;
const mongoose_1 = require("mongoose");
const vehicleSchema = new mongoose_1.Schema({
    registrationNumber: { type: String, required: true, unique: true },
    model: { type: String, required: true },
    manufacturer: { type: String },
    vehicleType: { type: mongoose_1.Schema.Types.ObjectId, ref: 'VehicleType', required: true },
    serviceMode: { type: String, enum: ['ride', 'transport'], required: true },
    categoryKey: { type: String, required: true },
    ownerType: { type: String, enum: ['driver', 'partner'], required: true },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, required: true, refPath: 'ownerModel' },
    ownerModel: { type: String, enum: ['Driver', 'TransportPartner'], required: true },
    capacity: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'blocked'], default: 'active' },
    documentsStatus: { type: String, enum: ['pending', 'verified', 'rejected', 'expired'], default: 'pending' },
}, { timestamps: true });
vehicleSchema.index({ ownerType: 1, ownerId: 1, status: 1 });
vehicleSchema.index({ categoryKey: 1, status: 1, ownerType: 1 });
exports.Vehicle = (0, mongoose_1.model)('Vehicle', vehicleSchema);
//# sourceMappingURL=Vehicle.js.map