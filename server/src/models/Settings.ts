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

    // Dispatch and trip rules used by the customer / rider apps
    dispatchRadiusKm: { type: Number, default: 5 },
    riderRequestTimeoutSeconds: { type: Number, default: 20 },
    maxDispatchAttempts: { type: Number, default: 5 },
    scheduleLeadMinutes: { type: Number, default: 15 },
    freeCancellationMinutes: { type: Number, default: 2 },
    freeWaitingMinutes: { type: Number, default: 3 },
    selfieCheckIntervalHours: { type: Number, default: 24 },
    maxCashDues: { type: Number, default: 500 },
    minWithdrawalAmount: { type: Number, default: 100 },
    referralEnabled: { type: Boolean, default: true },
    referralRewardReferrer: { type: Number, default: 50 },
    referralRewardReferee: { type: Number, default: 50 },
    customerAppMinVersion: { type: String, default: '1.0.0' },
    riderAppMinVersion: { type: String, default: '1.0.0' },
  },
  { timestamps: true },
)

export type SettingsDocument = InferSchemaType<typeof settingsSchema>
export const Settings = model('Settings', settingsSchema)
