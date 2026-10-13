import { Schema, model, type InferSchemaType } from 'mongoose'

const refundSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
    // `processing` while the gateway refund call is in flight, so it can never be sent twice.
    status: { type: String, enum: ['requested', 'approved', 'rejected', 'processing', 'processed'], default: 'requested' },
    requestedBy: { type: String },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
    processedAt: { type: Date },
    // Where the money went: back to the original online payment (bank / card / UPI) or the customer's wallet.
    destination: { type: String, enum: ['source', 'wallet'] },
    gatewayRefundId: { type: String, index: true, sparse: true },
    // Bank-side state of a source refund (Razorpay takes 5-7 working days to settle it).
    gatewayStatus: { type: String, enum: ['pending', 'processed', 'failed'] },
  },
  { timestamps: true },
)

export type RefundDocument = InferSchemaType<typeof refundSchema>
export const Refund = model('Refund', refundSchema)
