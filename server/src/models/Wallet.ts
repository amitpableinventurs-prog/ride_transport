import { Schema, model, type InferSchemaType } from 'mongoose'

const walletSchema = new Schema(
  {
    ownerType: { type: String, enum: ['customer', 'driver', 'partner'], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
  },
  { timestamps: true },
)

walletSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true })

export type WalletDocument = InferSchemaType<typeof walletSchema>
export const Wallet = model('Wallet', walletSchema)
