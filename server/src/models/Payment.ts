import { Schema, model, type InferSchemaType } from 'mongoose'

const paymentSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'upi', 'card', 'netbanking', 'wallet'], required: true },
    gateway: { type: String, enum: ['razorpay', 'stripe', 'cash', 'internal'], default: 'internal' },
    gatewayRefId: { type: String },
    status: { type: String, enum: ['initiated', 'success', 'failed', 'refunded'], default: 'initiated' },
  },
  { timestamps: true },
)

export type PaymentDocument = InferSchemaType<typeof paymentSchema>
export const Payment = model('Payment', paymentSchema)
