import { Schema, model, type InferSchemaType } from 'mongoose'
import { idToJson } from '../utils/schemaOptions'
import { personalProfileFields } from './personalProfile'

const customerSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, required: true, index: true },
    ...personalProfileFields,
    status: { type: String, enum: ['active', 'suspended', 'blocked'], default: 'active' },
    city: { type: String },
    totalBookings: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: idToJson },
)

export type CustomerDocument = InferSchemaType<typeof customerSchema>
export const Customer = model('Customer', customerSchema)
