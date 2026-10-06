import { Schema, model, type InferSchemaType } from 'mongoose'

const commissionRuleSchema = new Schema(
  {
    appliesTo: { type: String, enum: ['driver', 'partner'], required: true },
    categoryKey: { type: String },
    // wrapped as `{ type: String }` because a sibling key literally named
    // "type" is reserved by Mongoose as SchemaType shorthand (see DashboardSnapshot.ts)
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true },
    effectiveFrom: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
)

export type CommissionRuleDocument = InferSchemaType<typeof commissionRuleSchema>
export const CommissionRule = model('CommissionRule', commissionRuleSchema)
