"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncentiveScheme = void 0;
const mongoose_1 = require("mongoose");
// Rider incentive schemes ("complete N trips, earn ₹X")
const incentiveSchemeSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    description: { type: String },
    serviceArea: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ServiceArea', default: null },
    categoryKeys: { type: [String], default: [] },
    targetTrips: { type: Number, required: true },
    rewardAmount: { type: Number, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
exports.IncentiveScheme = (0, mongoose_1.model)('IncentiveScheme', incentiveSchemeSchema);
//# sourceMappingURL=IncentiveScheme.js.map