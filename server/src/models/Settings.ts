import { Schema, model, type InferSchemaType } from 'mongoose'

const settingsSchema = new Schema(
  {
    singleton: { type: String, required: true, unique: true, default: 'platform' },
    platformName: { type: String, required: true, default: 'AnZ Cabs' },
    supportEmail: { type: String, required: true, default: 'support@rideflow.demo' },
    supportPhone: { type: String, required: true, default: '+91 1800 200 3000' },
    defaultCurrency: { type: String, required: true, default: 'INR' },
    defaultCountry: { type: String, required: true, default: 'India' },
    rideServiceEnabled: { type: Boolean, default: true },
    transportServiceEnabled: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    otpExpiryMinutes: { type: Number, default: 5 },
    adminLoginOtpEnabled: { type: Boolean, default: true },
    accessTokenTtlMinutes: { type: Number, default: 15 },
    refreshTokenTtlDays: { type: Number, default: 7 },
  },
  { timestamps: true },
)

export type SettingsDocument = InferSchemaType<typeof settingsSchema>
export const Settings = model('Settings', settingsSchema)
