"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationBroadcast = void 0;
const mongoose_1 = require("mongoose");
const notificationBroadcastSchema = new mongoose_1.Schema({
    template: { type: mongoose_1.Schema.Types.ObjectId, ref: 'NotificationTemplate', default: null },
    channel: { type: String, enum: ['push', 'sms', 'email'], required: true },
    audience: { type: String, enum: ['all_customers', 'all_drivers', 'all_partners', 'custom'], required: true },
    serviceModeFilter: { type: String, enum: ['ride', 'transport', 'both'], default: 'both' },
    title: { type: String, required: true },
    body: { type: String, required: true },
    sentBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Admin', required: true },
    recipientCountEstimate: { type: Number, default: 0 },
}, { timestamps: true });
exports.NotificationBroadcast = (0, mongoose_1.model)('NotificationBroadcast', notificationBroadcastSchema);
//# sourceMappingURL=NotificationBroadcast.js.map