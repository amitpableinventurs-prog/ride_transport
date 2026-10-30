"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rating = void 0;
const mongoose_1 = require("mongoose");
const ratingSchema = new mongoose_1.Schema({
    booking: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', required: true },
    customer: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true },
    driver: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Driver', default: null },
    ratedBy: { type: String, enum: ['customer', 'driver'], required: true },
    score: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String },
}, { timestamps: true });
exports.Rating = (0, mongoose_1.model)('Rating', ratingSchema);
//# sourceMappingURL=Rating.js.map