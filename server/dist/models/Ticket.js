"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Ticket = exports.CLAIM_TYPES = void 0;
const mongoose_1 = require("mongoose");
exports.CLAIM_TYPES = ['damaged_goods', 'lost_goods', 'overcharged', 'other'];
// Unifies SRS section 23's "Complaints" and "Tickets" sidebar entries — both
// described with the same categories/statuses, so one collection backs both views.
const ticketSchema = new mongoose_1.Schema({
    subject: { type: String, required: true },
    category: {
        type: String,
        enum: ['payment', 'booking', 'driver', 'vehicle', 'lost_item', 'refund', 'cancellation', 'technical', 'claim'],
        required: true,
    },
    raisedByType: { type: String, enum: ['customer', 'driver', 'partner'], required: true },
    raisedByName: { type: String, required: true },
    raisedById: { type: mongoose_1.Schema.Types.ObjectId, default: null },
    description: { type: String },
    booking: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', default: null },
    status: { type: String, enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'], default: 'open' },
    assignedTo: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Admin', default: null },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    notes: [
        {
            by: String,
            text: String,
            at: { type: Date, default: Date.now },
        },
    ],
    resolvedAt: { type: Date },
    // Customer app "Claims" (category "claim"): compensation asked for a booking, e.g. goods damaged in transit.
    claim: {
        type: new mongoose_1.Schema({
            type: { type: String, enum: exports.CLAIM_TYPES, required: true },
            amount: { type: Number, min: 0 },
            photos: { type: [String], default: [] },
        }, { _id: false }),
        default: undefined,
    },
}, { timestamps: true });
exports.Ticket = (0, mongoose_1.model)('Ticket', ticketSchema);
//# sourceMappingURL=Ticket.js.map