import { Schema, model, type InferSchemaType } from 'mongoose'

const serviceAreaSchema = new Schema(
  {
    name: { type: String, required: true },
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    zone: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    rideEnabled: { type: Boolean, default: true },
    transportEnabled: { type: Boolean, default: true },
    geofence: {
      centerLat: Number,
      centerLng: Number,
      radiusKm: Number,
    },
  },
  { timestamps: true },
)

export type ServiceAreaDocument = InferSchemaType<typeof serviceAreaSchema>
export const ServiceArea = model('ServiceArea', serviceAreaSchema)
