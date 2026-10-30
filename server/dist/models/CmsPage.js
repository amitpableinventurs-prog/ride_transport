"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CmsPage = void 0;
const mongoose_1 = require("mongoose");
const cmsPageSchema = new mongoose_1.Schema({
    slug: {
        type: String,
        required: true,
        unique: true,
        enum: ['about', 'contact', 'terms', 'privacy', 'cancellation', 'refund', 'rider_terms', 'rider_privacy', 'partner_terms', 'faq'],
    },
    title: { type: String, required: true },
    content: { type: String, default: '' },
    updatedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });
exports.CmsPage = (0, mongoose_1.model)('CmsPage', cmsPageSchema);
//# sourceMappingURL=CmsPage.js.map