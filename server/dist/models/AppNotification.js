"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppNotification = void 0;
const mongoose_1 = require("mongoose");
const jwt_1 = require("../utils/jwt");
// Notification inbox
const appNotificationSchema = new mongoose_1.Schema({
    userType: { type: String, enum: jwt_1.APP_USER_TYPES, required: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: mongoose_1.Schema.Types.Mixed },
    readAt: { type: Date, default: null },
}, { timestamps: true });
appNotificationSchema.index({ userType: 1, userId: 1, createdAt: -1 });
exports.AppNotification = (0, mongoose_1.model)('AppNotification', appNotificationSchema);
//# sourceMappingURL=AppNotification.js.map