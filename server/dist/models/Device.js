"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Device = void 0;
const mongoose_1 = require("mongoose");
const jwt_1 = require("../utils/jwt");
// Push devices (FCM)
const deviceSchema = new mongoose_1.Schema({
    userType: { type: String, enum: jwt_1.APP_USER_TYPES, required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'android' },
    appVersion: { type: String },
    lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });
deviceSchema.index({ userType: 1, userId: 1 });
exports.Device = (0, mongoose_1.model)('Device', deviceSchema);
//# sourceMappingURL=Device.js.map