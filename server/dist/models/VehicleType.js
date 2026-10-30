"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VehicleType = void 0;
const mongoose_1 = require("mongoose");
const vehicleTypeSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    serviceMode: { type: String, enum: ['ride', 'transport'], required: true },
    capacityLabel: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
exports.VehicleType = (0, mongoose_1.model)('VehicleType', vehicleTypeSchema);
//# sourceMappingURL=VehicleType.js.map