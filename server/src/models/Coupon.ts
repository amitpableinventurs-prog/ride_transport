import { Schema, model, type InferSchemaType } from 'mongoose'

const couponSchema = new Schema(
  {
    code: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    title: { type: String, required: true },
    autoApply: { type: Boolean, default: false },
    discountType: { type: String, enum: ['flat', 'percentage'], required: true },
    amount: { type: Number, required: true },
    minBookingAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    validFrom: { type: Date, required: true },
    validTo: { type: Date, required: true },
    usageLimitTotal: { type: Number },
    usageLimitPerUser: { type: Number },
    usedCount: { type: Number, default: 0 },
    applicableMode: { type: String, enum: ['ride', 'transport', 'both'], default: 'both' },
    applicableCategories: [{ type: String }],
    serviceAreas: [{ type: Schema.Types.ObjectId, ref: 'ServiceArea' }],
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
)

export type CouponDocument = InferSchemaType<typeof couponSchema>
export const Coupon = model('Coupon', couponSchema)
