import { Schema, model, type InferSchemaType } from 'mongoose'

const ratingSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    driver: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
    ratedBy: { type: String, enum: ['customer', 'driver'], required: true },
    score: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String },
  },
  { timestamps: true },
)

export type RatingDocument = InferSchemaType<typeof ratingSchema>
export const Rating = model('Rating', ratingSchema)
