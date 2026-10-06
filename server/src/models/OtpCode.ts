import { Schema, model, type InferSchemaType } from 'mongoose'

// One live OTP per (purpose, key). Sending again replaces the code; the doc is
// kept between sends so the resend cooldown and hourly send limit can be enforced.
const otpCodeSchema = new Schema(
  {
    purpose: { type: String, enum: ['admin_login', 'app_login'], required: true },
    // admin_login: the admin's id. app_login: `${userType}:${normalizedPhone}`.
    key: { type: String, required: true },
    channel: { type: String, enum: ['sms'], default: 'sms' },
    destination: { type: String, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 1 },
    windowStartedAt: { type: Date, required: true },
    lastSentAt: { type: Date, required: true },
  },
  { timestamps: true },
)

otpCodeSchema.index({ purpose: 1, key: 1 }, { unique: true })
// Clean up a day after the last send (longer than the hourly send-limit window).
otpCodeSchema.index({ lastSentAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 })

export type OtpCodeDocument = InferSchemaType<typeof otpCodeSchema>
export const OtpCode = model('OtpCode', otpCodeSchema)
