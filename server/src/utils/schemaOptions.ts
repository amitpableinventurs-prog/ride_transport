import type { ToObjectOptions } from 'mongoose'

// Express serializes Mongoose documents via toJSON(), which by default keeps
// `_id` and drops the `id` virtual — but the frontend types (AdminUser,
// Customer, Driver, ...) all key off `id`. Apply this to any schema whose
// documents are sent straight to the client.
export const idToJson: ToObjectOptions = {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret._id
    return ret
  },
}
