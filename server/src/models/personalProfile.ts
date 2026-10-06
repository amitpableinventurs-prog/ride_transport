import { Schema } from 'mongoose'

export const GENDERS = ['male', 'female', 'other'] as const
export type Gender = (typeof GENDERS)[number]

const emergencyContactSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
  },
  { _id: false },
)

// Personal details collected on the mobile app's Profile screen.
// Shared by Customer and Driver (partners register as a company instead).
export const personalProfileFields = {
  gender: { type: String, enum: GENDERS },
  dateOfBirth: { type: Date },
  emergencyContact: { type: emergencyContactSchema, default: undefined },
}
