import { RevokedToken } from '../models/RevokedToken'
import { env } from '../config/env'

// Refresh tokens are single-use. Every use records the token id; presenting an id a second time means the
// token was copied, so the whole login session (family) is revoked, including its access tokens.

const DAY_MS = 86_400_000
const familyKey = (fid: string) => `fam:${fid}`
const longestSessionMs = () => Math.max(env.refreshTokenTtlDays, env.appRefreshTokenTtlDays) * DAY_MS

/** Marks a refresh token as used. Returns false when it was already used (replay). Atomic: only one caller wins. */
export async function claimRefreshToken(jti: string | undefined, exp: number | undefined): Promise<boolean> {
  if (!jti || !exp) return false
  try {
    await RevokedToken.create({ jti, expiresAt: new Date(exp * 1000) })
    return true
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return false
    throw err
  }
}

/** Ends a whole login session: its refresh token can no longer be used and its access tokens stop working. */
export async function revokeSession(fid: string | undefined): Promise<void> {
  if (!fid) return
  await RevokedToken.updateOne({ jti: familyKey(fid) }, { $setOnInsert: { jti: familyKey(fid), expiresAt: new Date(Date.now() + longestSessionMs()) } }, { upsert: true })
}

export async function isSessionRevoked(fid: string | undefined): Promise<boolean> {
  if (!fid) return true
  return Boolean(await RevokedToken.exists({ jti: familyKey(fid) }))
}
