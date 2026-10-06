import { Schema, model } from 'mongoose'

// Revoked app refresh tokens (logout / rotation)
const revokedTokenSchema = new Schema({
  jti: { type: String, required: true, unique: true },
  // MongoDB deletes the record once the token would have expired anyway.
  expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
})
export const RevokedToken = model('RevokedToken', revokedTokenSchema)
