import { Schema, model, type InferSchemaType } from 'mongoose'
import { PERMISSION_KEYS, ROLE_KEYS } from '../types/rbac'

const roleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, enum: ROLE_KEYS },
    name: { type: String, required: true },
    description: { type: String, required: true },
    permissions: [{ type: String, enum: PERMISSION_KEYS }],
    isSystem: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export type RoleDocument = InferSchemaType<typeof roleSchema>
export const Role = model('Role', roleSchema)
