import { Schema, model, type InferSchemaType } from 'mongoose'

const bannerSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    imageUrl: { type: String, required: true },
    ctaLabel: { type: String },
    targetLink: { type: String },
    serviceMode: { type: String, enum: ['ride', 'transport', 'both'], default: 'both' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
)

export type BannerDocument = InferSchemaType<typeof bannerSchema>
export const Banner = model('Banner', bannerSchema)
