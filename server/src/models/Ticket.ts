import { Schema, model, type InferSchemaType } from 'mongoose'

export const CLAIM_TYPES = ['damaged_goods', 'lost_goods', 'overcharged', 'other'] as const

// Unifies SRS section 23's "Complaints" and "Tickets" sidebar entries — both
// described with the same categories/statuses, so one collection backs both views.
const ticketSchema = new Schema(
  {
    subject: { type: String, required: true },
    category: {
      type: String,
      enum: ['payment', 'booking', 'driver', 'vehicle', 'lost_item', 'refund', 'cancellation', 'technical', 'claim'],
      required: true,
    },
    raisedByType: { type: String, enum: ['customer', 'driver', 'partner'], required: true },
    raisedByName: { type: String, required: true },
    raisedById: { type: Schema.Types.ObjectId, default: null },
    description: { type: String },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    status: { type: String, enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'], default: 'open' },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
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
      type: new Schema(
        {
          type: { type: String, enum: CLAIM_TYPES, required: true },
          amount: { type: Number, min: 0 },
          photos: { type: [String], default: [] },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
)

export type TicketDocument = InferSchemaType<typeof ticketSchema>
export const Ticket = model('Ticket', ticketSchema)
