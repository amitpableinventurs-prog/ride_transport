"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationTemplate = void 0;
const mongoose_1 = require("mongoose");
const notificationTemplateSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true },
    channel: { type: String, enum: ['push', 'sms', 'email'], required: true },
    title: { type: String },
    body: { type: String, required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
}, { timestamps: true });
exports.NotificationTemplate = (0, mongoose_1.model)('NotificationTemplate', notificationTemplateSchema);
//# sourceMappingURL=NotificationTemplate.js.map