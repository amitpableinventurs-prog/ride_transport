import { Schema, model, type InferSchemaType } from 'mongoose'

// Unifies SRS section 23's "Complaints" and "Tickets" sidebar entries — both
// described with the same categories/statuses, so one collection backs both views.
const ticketSchema = new Schema(
  {
    subject: { type: String, required: true },
    category: {
      type: String,
      enum: ['payment', 'booking', 'driver', 'vehicle', 'lost_item', 'refund', 'cancellation', 'technical'],
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
  },
  { timestamps: true },
)

export type TicketDocument = InferSchemaType<typeof ticketSchema>
export const Ticket = model('Ticket', ticketSchema)
