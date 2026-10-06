import { Schema, model, type InferSchemaType } from 'mongoose'

const transportPartnerSchema = new Schema(
  {
    companyName: { type: String, required: true },
    ownerName: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, required: true, index: true },
    businessRegNo: { type: String },
    taxId: { type: String },
    approvalStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    status: { type: String, enum: ['active', 'suspended', 'blocked'], default: 'active' },
    vehicleCount: { type: Number, default: 0 },
    driverCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export type TransportPartnerDocument = InferSchemaType<typeof transportPartnerSchema>
export const TransportPartner = model('TransportPartner', transportPartnerSchema)
