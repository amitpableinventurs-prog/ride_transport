"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceCategory = void 0;
const mongoose_1 = require("mongoose");
const serviceCategorySchema = new mongoose_1.Schema({
    mode: { type: String, enum: ['ride', 'transport'], required: true },
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String },
    icon: { type: String, default: 'car' },
    seats: { type: Number },
    capacityLabel: { type: String },
    vehicleType: { type: mongoose_1.Schema.Types.ObjectId, ref: 'VehicleType' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });
exports.ServiceCategory = (0, mongoose_1.model)('ServiceCategory', serviceCategorySchema);
//# sourceMappingURL=ServiceCategory.js.map