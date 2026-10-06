import { Schema, model, type InferSchemaType } from 'mongoose'
import { ROLE_KEYS } from '../types/rbac'
import { idToJson } from '../utils/schemaOptions'

const adminSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: ROLE_KEYS },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    avatarColor: { type: String, default: '#1f2f52' },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: idToJson },
)

export type AdminDocument = InferSchemaType<typeof adminSchema>
export const Admin = model('Admin', adminSchema)
