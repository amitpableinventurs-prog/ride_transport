import { Schema, model, type InferSchemaType } from 'mongoose'

const sosRequestSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    raisedBy: { type: String, enum: ['customer', 'driver'], required: true },
    userName: { type: String, required: true },
    location: {
      lat: Number,
      lng: Number,
    },
    status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
    notes: [
      {
        by: String,
        text: String,
        at: { type: Date, default: Date.now },
      },
    ],
    resolvedAt: { type: Date },
  },
  { timestamps: true },
)

export type SosRequestDocument = InferSchemaType<typeof sosRequestSchema>
export const SosRequest = model('SosRequest', sosRequestSchema)
