"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimRefreshToken = claimRefreshToken;
exports.revokeSession = revokeSession;
exports.isSessionRevoked = isSessionRevoked;
const RevokedToken_1 = require("../models/RevokedToken");
const env_1 = require("../config/env");
// Refresh tokens are single-use. Every use records the token id; presenting an id a second time means the
// token was copied, so the whole login session (family) is revoked, including its access tokens.
const DAY_MS = 86_400_000;
const familyKey = (fid) => `fam:${fid}`;
const longestSessionMs = () => Math.max(env_1.env.refreshTokenTtlDays, env_1.env.appRefreshTokenTtlDays) * DAY_MS;
/** Marks a refresh token as used. Returns false when it was already used (replay). Atomic: only one caller wins. */
async function claimRefreshToken(jti, exp) {
    if (!jti || !exp)
        return false;
    try {
        await RevokedToken_1.RevokedToken.create({ jti, expiresAt: new Date(exp * 1000) });
        return true;
    }
    catch (err) {
        if (err.code === 11000)
            return false;
        throw err;
    }
}
/** Ends a whole login session: its refresh token can no longer be used and its access tokens stop working. */
async function revokeSession(fid) {
    if (!fid)
        return;
    await RevokedToken_1.RevokedToken.updateOne({ jti: familyKey(fid) }, { $setOnInsert: { jti: familyKey(fid), expiresAt: new Date(Date.now() + longestSessionMs()) } }, { upsert: true });
}
async function isSessionRevoked(fid) {
    if (!fid)
        return true;
    return Boolean(await RevokedToken_1.RevokedToken.exists({ jti: familyKey(fid) }));
}
//# sourceMappingURL=sessions.js.map