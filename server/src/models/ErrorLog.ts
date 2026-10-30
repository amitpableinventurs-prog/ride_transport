import { Schema, model, type InferSchemaType } from 'mongoose'

// Where an error came from: one of the mobile apps (reported through POST /common/error-logs)
// or the API itself (unexpected 500s, recorded by the error handler).
export const ERROR_SOURCES = ['customer_app', 'rider_app', 'partner_app', 'api'] as const
export const APP_ERROR_SOURCES = ['customer_app', 'rider_app', 'partner_app'] as const
export const ERROR_LEVELS = ['fatal', 'error', 'warning'] as const
export const ERROR_PLATFORMS = ['android', 'ios', 'web', 'server'] as const

// Logs older than this are removed automatically by MongoDB (TTL index on createdAt).
export const ERROR_LOG_RETENTION_DAYS = 90

const errorLogSchema = new Schema(
  {
    source: { type: String, enum: ERROR_SOURCES, required: true },
    level: { type: String, enum: ERROR_LEVELS, default: 'error' },
    message: { type: String, required: true },
    stack: { type: String },
    // App screen, or "METHOD /path" for API errors.
    screen: { type: String },
    platform: { type: String, enum: ERROR_PLATFORMS },
    appVersion: { type: String },
    osVersion: { type: String },
    deviceModel: { type: String },
    // Signed-in user at the time, if any (app reports can come before login).
    userType: { type: String, enum: ['customer', 'driver', 'partner', 'admin'] },
    userId: { type: Schema.Types.ObjectId, default: null },
    userName: { type: String },
    userPhone: { type: String },
    // Extra key/value details sent by the app (booking id, network type, ...).
    context: { type: Schema.Types.Mixed },
    ip: { type: String },
    // When it happened on the device; createdAt is when the API received it (apps may send queued reports later).
    occurredAt: { type: Date, required: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
  },
  { timestamps: true },
)

errorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: ERROR_LOG_RETENTION_DAYS * 24 * 60 * 60 })
errorLogSchema.index({ occurredAt: -1 })
errorLogSchema.index({ source: 1, occurredAt: -1 })
errorLogSchema.index({ status: 1, occurredAt: -1 })

export type ErrorLogDocument = InferSchemaType<typeof errorLogSchema>
export const ErrorLog = model('ErrorLog', errorLogSchema)
