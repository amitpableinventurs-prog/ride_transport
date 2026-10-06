import { Schema, model, type InferSchemaType } from 'mongoose'

const refundSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['requested', 'approved', 'rejected', 'processed'], default: 'requested' },
    requestedBy: { type: String },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    processedAt: { type: Date },
  },
  { timestamps: true },
)

export type RefundDocument = InferSchemaType<typeof refundSchema>
export const Refund = model('Refund', refundSchema)
