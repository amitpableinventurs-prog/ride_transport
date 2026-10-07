import { Schema, model, type InferSchemaType } from 'mongoose'
import { idToJson } from '../utils/schemaOptions'
import { emergencyContactSchema, personalProfileFields } from './personalProfile'

export const SAVED_PLACE_LABELS = ['home', 'work', 'other'] as const

const savedPlaceSchema = new Schema(
  {
    label: { type: String, enum: SAVED_PLACE_LABELS, required: true },
    name: { type: String, trim: true },
    address: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { toJSON: idToJson },
)

const customerSchema = new Schema(
  {
    // Empty until the user fills the Profile screen (SRS sign-up creates the account at OTP verify).
    name: { type: String, default: '', trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, required: true, index: true },
    ...personalProfileFields,
    status: { type: String, enum: ['active', 'suspended', 'blocked'], default: 'active' },
    city: { type: String },
    totalBookings: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    savedPlaces: { type: [savedPlaceSchema], default: [] },
    // SOS contacts (max 3). emergencyContact mirrors the first one for the Profile screen.
    emergencyContacts: { type: [emergencyContactSchema], default: [] },
    // Refer & Earn: own shareable code, who referred this customer, and whether the first-ride reward was paid.
    referralCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    referralRewardedAt: { type: Date },
    deletionRequestedAt: { type: Date },
    deletionReason: { type: String },
  },
  { timestamps: true, toJSON: idToJson },
)

export type CustomerDocument = InferSchemaType<typeof customerSchema>
export const Customer = model('Customer', customerSchema)
