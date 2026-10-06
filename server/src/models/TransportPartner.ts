import crypto from 'crypto'
import { Schema, model, type InferSchemaType } from 'mongoose'

export function generatePartnerCode(): string {
  return `P${crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`
}

const transportPartnerSchema = new Schema(
  {
    companyName: { type: String, required: true },
    ownerName: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, required: true, index: true },
    // Riders enter this code during onboarding to join the partner's fleet.
    partnerCode: { type: String, unique: true, sparse: true, uppercase: true },
    businessRegNo: { type: String },
    taxId: { type: String },
    approvalStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    status: { type: String, enum: ['active', 'suspended', 'blocked'], default: 'active' },
    vehicleCount: { type: Number, default: 0 },
    driverCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

transportPartnerSchema.pre('validate', function (next) {
  if (!this.partnerCode) this.partnerCode = generatePartnerCode()
  next()
})

export type TransportPartnerDocument = InferSchemaType<typeof transportPartnerSchema>
export const TransportPartner = model('TransportPartner', transportPartnerSchema)
