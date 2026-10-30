"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentRecord = void 0;
const mongoose_1 = require("mongoose");
const documentSchema = new mongoose_1.Schema({
    ownerType: { type: String, enum: ['driver', 'partner', 'vehicle'], required: true },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    docType: { type: String, required: true },
    docNumber: { type: String, trim: true },
    fileUrl: { type: String, required: true },
    // Back side of two-sided documents (driving licence, RC, Aadhaar).
    backUrl: { type: String },
    status: { type: String, enum: ['pending', 'verified', 'rejected', 'expired'], default: 'pending' },
    expiryDate: { type: Date },
    reviewedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
}, { timestamps: true });
documentSchema.index({ ownerType: 1, ownerId: 1, docType: 1 });
exports.DocumentRecord = (0, mongoose_1.model)('DocumentRecord', documentSchema, 'documents');
//# sourceMappingURL=Document.js.map