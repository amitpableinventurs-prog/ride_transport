import { Schema, model, type InferSchemaType } from 'mongoose'

const notificationTemplateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    channel: { type: String, enum: ['push', 'sms', 'email'], required: true },
    title: { type: String },
    body: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true },
)

export type NotificationTemplateDocument = InferSchemaType<typeof notificationTemplateSchema>
export const NotificationTemplate = model('NotificationTemplate', notificationTemplateSchema)
