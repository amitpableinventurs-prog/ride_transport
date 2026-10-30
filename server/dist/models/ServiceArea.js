"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceArea = void 0;
const mongoose_1 = require("mongoose");
const serviceAreaSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    zone: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    rideEnabled: { type: Boolean, default: true },
    transportEnabled: { type: Boolean, default: true },
    geofence: {
        centerLat: Number,
        centerLng: Number,
        radiusKm: Number,
    },
}, { timestamps: true });
exports.ServiceArea = (0, mongoose_1.model)('ServiceArea', serviceAreaSchema);
//# sourceMappingURL=ServiceArea.js.map