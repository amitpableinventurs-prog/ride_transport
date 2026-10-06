import { Schema, model, type InferSchemaType } from 'mongoose'

const auditLogSchema = new Schema(
  {
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetLabel: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>
export const AuditLog = model('AuditLog', auditLogSchema)
