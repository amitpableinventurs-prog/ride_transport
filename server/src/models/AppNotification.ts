import { Schema, model } from 'mongoose'
import { APP_USER_TYPES } from '../utils/jwt'

// Notification inbox
const appNotificationSchema = new Schema(
  {
    userType: { type: String, enum: APP_USER_TYPES, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Schema.Types.Mixed },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
)
appNotificationSchema.index({ userType: 1, userId: 1, createdAt: -1 })
export const AppNotification = model('AppNotification', appNotificationSchema)
