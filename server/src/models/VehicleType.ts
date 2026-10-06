import { Schema, model, type InferSchemaType } from 'mongoose'

const vehicleTypeSchema = new Schema(
  {
    name: { type: String, required: true },
    serviceMode: { type: String, enum: ['ride', 'transport'], required: true },
    capacityLabel: { type: String },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
)

export type VehicleTypeDocument = InferSchemaType<typeof vehicleTypeSchema>
export const VehicleType = model('VehicleType', vehicleTypeSchema)
