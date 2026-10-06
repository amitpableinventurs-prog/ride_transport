import { Schema, model } from 'mongoose'

// Rider incentive schemes ("complete N trips, earn ₹X")
const incentiveSchemeSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    serviceArea: { type: Schema.Types.ObjectId, ref: 'ServiceArea', default: null },
    categoryKeys: { type: [String], default: [] },
    targetTrips: { type: Number, required: true },
    rewardAmount: { type: Number, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
)
export const IncentiveScheme = model('IncentiveScheme', incentiveSchemeSchema)
