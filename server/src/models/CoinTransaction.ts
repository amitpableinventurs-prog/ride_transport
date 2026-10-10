import { Schema, model, type InferSchemaType } from 'mongoose'

// anzcabs Coins ledger for customers. The balance lives on Customer.coins; every change is recorded here.
// Earning and spending rules are not decided yet, so nothing writes coins automatically.
const coinTransactionSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    // wrapped as `{ type: String }`: a field literally named "type" must be wrapped for Mongoose.
    type: { type: String, enum: ['credit', 'debit'], required: true },
    coins: { type: Number, required: true },
    reason: { type: String, enum: ['ride', 'referral', 'bonus', 'redeemed', 'expired', 'adjustment'], required: true },
    note: { type: String },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: true },
)
coinTransactionSchema.index({ customer: 1, createdAt: -1 })

export type CoinTransactionDocument = InferSchemaType<typeof coinTransactionSchema>
export const CoinTransaction = model('CoinTransaction', coinTransactionSchema)
