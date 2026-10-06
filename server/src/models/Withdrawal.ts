import { Schema, model, type InferSchemaType } from 'mongoose'

// Rider payouts
const withdrawalSchema = new Schema(
  {
    driver: { type: Schema.Types.ObjectId, ref: 'Driver', required: true, index: true },
    wallet: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['bank', 'upi'], required: true },
    upiId: { type: String },
    bankAccount: {
      holderName: String,
      accountNumber: String,
      ifsc: String,
    },
    status: { type: String, enum: ['requested', 'processing', 'paid', 'rejected'], default: 'requested' },
    reference: { type: String },
    rejectionReason: { type: String },
    processedAt: { type: Date },
  },
  { timestamps: true },
)
export type WithdrawalDocument = InferSchemaType<typeof withdrawalSchema>
export const Withdrawal = model('Withdrawal', withdrawalSchema)
