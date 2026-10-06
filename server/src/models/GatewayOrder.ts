import { Schema, model, type InferSchemaType } from 'mongoose'

// Payment gateway orders (booking payment, wallet top-up, rider dues)
const gatewayOrderSchema = new Schema(
  {
    purpose: { type: String, enum: ['booking', 'wallet_topup', 'rider_dues'], required: true },
    ownerType: { type: String, enum: ['customer', 'driver'], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    provider: { type: String, required: true },
    providerOrderId: { type: String, required: true, unique: true },
    providerPaymentId: { type: String },
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created' },
    paidAt: { type: Date },
  },
  { timestamps: true },
)
export type GatewayOrderDocument = InferSchemaType<typeof gatewayOrderSchema>
export const GatewayOrder = model('GatewayOrder', gatewayOrderSchema)
