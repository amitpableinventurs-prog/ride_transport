"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingRule = void 0;
const mongoose_1 = require("mongoose");
const pricingRuleSchema = new mongoose_1.Schema({
    mode: { type: String, enum: ['ride', 'transport'], required: true },
    categoryKey: { type: String, required: true },
    serviceArea: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ServiceArea', default: null },
    baseFare: { type: Number, required: true },
    perKm: { type: Number, required: true },
    perMinute: { type: Number, default: 0 },
    minimumFare: { type: Number, required: true },
    waitingChargePerMin: { type: Number, default: 0 },
    nightChargeMultiplier: { type: Number, default: 1 },
    platformFeeFlat: { type: Number, default: 0 },
    platformFeePercent: { type: Number, default: 0 },
    cancellationFee: { type: Number, default: 0 },
    loadingUnloadingCharge: { type: Number, default: 0 },
    additionalStopCharge: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    effectiveFrom: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
exports.PricingRule = (0, mongoose_1.model)('PricingRule', pricingRuleSchema);
//# sourceMappingURL=PricingRule.js.map