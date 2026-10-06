import { Schema, model, type InferSchemaType } from 'mongoose'

const pricingRuleSchema = new Schema(
  {
    mode: { type: String, enum: ['ride', 'transport'], required: true },
    categoryKey: { type: String, required: true },
    serviceArea: { type: Schema.Types.ObjectId, ref: 'ServiceArea', default: null },
    baseFare: { type: Number, required: true },
    perKm: { type: Number, required: true },
    perMinute: { type: Number, default: 0 },
    minimumFare: { type: Number, required: true },
    waitingChargePerMin: { type: Number, default: 0 },
    nightChargeMultiplier: { type: Number, default: 1 },
    platformFeeFlat: { type: Number, default: 0 },
    platformFeePercent: { type: Number, default: 0 },
    cancellationFee: { type: Number, default: 0 },
    loadingUnloadingCharge: { type: Number, default: 0 },
    additionalStopCharge: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    effectiveFrom: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
)

export type PricingRuleDocument = InferSchemaType<typeof pricingRuleSchema>
export const PricingRule = model('PricingRule', pricingRuleSchema)
