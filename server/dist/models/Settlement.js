"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Settlement = void 0;
const mongoose_1 = require("mongoose");
const settlementSchema = new mongoose_1.Schema({
    payeeType: { type: String, enum: ['driver', 'partner'], required: true },
    payeeId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    grossEarnings: { type: Number, required: true },
    commissionDeducted: { type: Number, required: true },
    netPayable: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'processing', 'paid'], default: 'pending' },
    paidAt: { type: Date },
}, { timestamps: true });
exports.Settlement = (0, mongoose_1.model)('Settlement', settlementSchema);
//# sourceMappingURL=Settlement.js.map