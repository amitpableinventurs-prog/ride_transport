"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Banner = void 0;
const mongoose_1 = require("mongoose");
const bannerSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String, required: true },
    ctaLabel: { type: String },
    targetLink: { type: String },
    serviceMode: { type: String, enum: ['ride', 'transport', 'both'], default: 'both' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
exports.Banner = (0, mongoose_1.model)('Banner', bannerSchema);
//# sourceMappingURL=Banner.js.map