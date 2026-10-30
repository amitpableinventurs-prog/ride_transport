"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Coupon = void 0;
const mongoose_1 = require("mongoose");
const couponSchema = new mongoose_1.Schema({
    code: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    title: { type: String, required: true },
    autoApply: { type: Boolean, default: false },
    discountType: { type: String, enum: ['flat', 'percentage'], required: true },
    amount: { type: Number, required: true },
    minBookingAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    usageLimitTotal: { type: Number },
    usageLimitPerUser: { type: Number },
    usedCount: { type: Number, default: 0 },
    applicableMode: { type: String, enum: ['ride', 'transport', 'both'], default: 'both' },
    applicableCategories: [{ type: String }],
    serviceAreas: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'ServiceArea' }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
exports.Coupon = (0, mongoose_1.model)('Coupon', couponSchema);
//# sourceMappingURL=Coupon.js.map