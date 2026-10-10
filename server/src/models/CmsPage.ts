import { Schema, model, type InferSchemaType } from 'mongoose'

const cmsPageSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      enum: ['about', 'contact', 'terms', 'privacy', 'cancellation', 'refund', 'rider_terms', 'rider_privacy', 'partner_terms', 'faq'],
    },
    title: { type: String, required: true },
    content: { type: String, default: '' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
  },
  { timestamps: true },
)

export type CmsPageDocument = InferSchemaType<typeof cmsPageSchema>
export const CmsPage = model('CmsPage', cmsPageSchema)
