import { Schema, model } from 'mongoose'
import { APP_USER_TYPES } from '../utils/jwt'

// Push devices (FCM)
const deviceSchema = new Schema(
  {
    userType: { type: String, enum: APP_USER_TYPES, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    appVersion: { type: String },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)
deviceSchema.index({ userType: 1, userId: 1 })
export const Device = model('Device', deviceSchema)
