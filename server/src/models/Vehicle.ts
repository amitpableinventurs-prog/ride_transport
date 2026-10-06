import { Schema, model, type InferSchemaType } from 'mongoose'

const vehicleSchema = new Schema(
  {
    registrationNumber: { type: String, required: true, unique: true },
    model: { type: String, required: true },
    manufacturer: { type: String },
    vehicleType: { type: Schema.Types.ObjectId, ref: 'VehicleType', required: true },
    serviceMode: { type: String, enum: ['ride', 'transport'], required: true },
    categoryKey: { type: String, required: true },
    ownerType: { type: String, enum: ['driver', 'partner'], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true, refPath: 'ownerModel' },
    ownerModel: { type: String, enum: ['Driver', 'TransportPartner'], required: true },
    capacity: { type: String },
    status: { type: String, enum: ['active', 'inactive', 'blocked'], default: 'active' },
    documentsStatus: { type: String, enum: ['pending', 'verified', 'rejected', 'expired'], default: 'pending' },
  },
  { timestamps: true },
)

export type VehicleDocument = InferSchemaType<typeof vehicleSchema>
export const Vehicle = model('Vehicle', vehicleSchema)
