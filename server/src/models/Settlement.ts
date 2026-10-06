import { Schema, model, type InferSchemaType } from 'mongoose'

const settlementSchema = new Schema(
  {
    payeeType: { type: String, enum: ['driver', 'partner'], required: true },
    payeeId: { type: Schema.Types.ObjectId, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    grossEarnings: { type: Number, required: true },
    commissionDeducted: { type: Number, required: true },
    netPayable: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'processing', 'paid'], default: 'pending' },
    paidAt: { type: Date },
  },
  { timestamps: true },
)

export type SettlementDocument = InferSchemaType<typeof settlementSchema>
export const Settlement = model('Settlement', settlementSchema)
