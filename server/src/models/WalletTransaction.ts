import { Schema, model, type InferSchemaType } from 'mongoose'

const walletTransactionSchema = new Schema(
  {
    wallet: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    // wrapped as `{ type: String }` — see CommissionRule.ts for why a field
    // literally named "type" must be wrapped for Mongoose.
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true },
    reason: {
      type: String,
      enum: ['booking_earning', 'commission', 'recharge', 'refund', 'penalty', 'bonus', 'withdrawal', 'adjustment'],
      required: true,
    },
    referenceType: { type: String },
    referenceId: { type: Schema.Types.ObjectId },
    balanceAfter: { type: Number, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true },
)

export type WalletTransactionDocument = InferSchemaType<typeof walletTransactionSchema>
export const WalletTransaction = model('WalletTransaction', walletTransactionSchema)
