"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommissionRule = void 0;
const mongoose_1 = require("mongoose");
const commissionRuleSchema = new mongoose_1.Schema({
    appliesTo: { type: String, enum: ['driver', 'partner'], required: true },
    categoryKey: { type: String },
    // wrapped as `{ type: String }` because a sibling key literally named
    // "type" is reserved by Mongoose as SchemaType shorthand (see DashboardSnapshot.ts)
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true },
    effectiveFrom: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
exports.CommissionRule = (0, mongoose_1.model)('CommissionRule', commissionRuleSchema);
//# sourceMappingURL=CommissionRule.js.map