import { Schema, model, type InferSchemaType } from 'mongoose'

const notificationBroadcastSchema = new Schema(
  {
    template: { type: Schema.Types.ObjectId, ref: 'NotificationTemplate', default: null },
    channel: { type: String, enum: ['push', 'sms', 'email'], required: true },
    audience: { type: String, enum: ['all_customers', 'all_drivers', 'all_partners', 'custom'], required: true },
    serviceModeFilter: { type: String, enum: ['ride', 'transport', 'both'], default: 'both' },
    title: { type: String, required: true },
    body: { type: String, required: true },
    sentBy: { type: Schema.Types.ObjectId, ref: 'Admin', required: true },
    recipientCountEstimate: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export type NotificationBroadcastDocument = InferSchemaType<typeof notificationBroadcastSchema>
export const NotificationBroadcast = model('NotificationBroadcast', notificationBroadcastSchema)
