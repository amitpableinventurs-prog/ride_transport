"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SosRequest = void 0;
const mongoose_1 = require("mongoose");
const sosRequestSchema = new mongoose_1.Schema({
    booking: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', default: null },
    raisedBy: { type: String, enum: ['customer', 'driver'], required: true },
    userName: { type: String, required: true },
    location: {
        lat: Number,
        lng: Number,
    },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
    notes: [
        {
            by: String,
            text: String,
            at: { type: Date, default: Date.now },
        },
    ],
    resolvedAt: { type: Date },
}, { timestamps: true });
exports.SosRequest = (0, mongoose_1.model)('SosRequest', sosRequestSchema);
//# sourceMappingURL=SosRequest.js.map