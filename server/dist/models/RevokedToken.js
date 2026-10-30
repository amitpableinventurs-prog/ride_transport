"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevokedToken = void 0;
const mongoose_1 = require("mongoose");
// Revoked app refresh tokens (logout / rotation)
const revokedTokenSchema = new mongoose_1.Schema({
    jti: { type: String, required: true, unique: true },
    // MongoDB deletes the record once the token would have expired anyway.
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
});
exports.RevokedToken = (0, mongoose_1.model)('RevokedToken', revokedTokenSchema);
//# sourceMappingURL=RevokedToken.js.map