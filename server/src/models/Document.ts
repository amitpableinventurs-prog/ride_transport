import { Schema, model, type InferSchemaType } from 'mongoose'

const documentSchema = new Schema(
  {
    ownerType: { type: String, enum: ['driver', 'partner', 'vehicle'], required: true },
    ownerId: { type: Schema.Types.ObjectId, required: true },
    docType: { type: String, required: true },
    fileUrl: { type: String, required: true },
    status: { type: String, enum: ['pending', 'verified', 'rejected', 'expired'], default: 'pending' },
    expiryDate: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String },
  },
  { timestamps: true },
)

export type DocumentRecordDocument = InferSchemaType<typeof documentSchema>
export const DocumentRecord = model('DocumentRecord', documentSchema, 'documents')
