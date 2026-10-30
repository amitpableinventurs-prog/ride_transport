"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorLog = exports.ERROR_LOG_RETENTION_DAYS = exports.ERROR_PLATFORMS = exports.ERROR_LEVELS = exports.APP_ERROR_SOURCES = exports.ERROR_SOURCES = void 0;
const mongoose_1 = require("mongoose");
// Where an error came from: one of the mobile apps (reported through POST /common/error-logs)
// or the API itself (unexpected 500s, recorded by the error handler).
exports.ERROR_SOURCES = ['customer_app', 'rider_app', 'partner_app', 'api'];
exports.APP_ERROR_SOURCES = ['customer_app', 'rider_app', 'partner_app'];
exports.ERROR_LEVELS = ['fatal', 'error', 'warning'];
exports.ERROR_PLATFORMS = ['android', 'ios', 'web', 'server'];
// Logs older than this are removed automatically by MongoDB (TTL index on createdAt).
exports.ERROR_LOG_RETENTION_DAYS = 90;
const errorLogSchema = new mongoose_1.Schema({
    source: { type: String, enum: exports.ERROR_SOURCES, required: true },
    level: { type: String, enum: exports.ERROR_LEVELS, default: 'error' },
    message: { type: String, required: true },
    stack: { type: String },
    // App screen, or "METHOD /path" for API errors.
    screen: { type: String },
    platform: { type: String, enum: exports.ERROR_PLATFORMS },
    appVersion: { type: String },
    osVersion: { type: String },
    deviceModel: { type: String },
    // Signed-in user at the time, if any (app reports can come before login).
    userType: { type: String, enum: ['customer', 'driver', 'partner', 'admin'] },
    userId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
    userName: { type: String },
    userPhone: { type: String },
    // Extra key/value details sent by the app (booking id, network type, ...).
    context: { type: mongoose_1.Schema.Types.Mixed },
    ip: { type: String },
    // When it happened on the device; createdAt is when the API received it (apps may send queued reports later).
    occurredAt: { type: Date, required: true },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
}, { timestamps: true });
errorLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: exports.ERROR_LOG_RETENTION_DAYS * 24 * 60 * 60 });
errorLogSchema.index({ occurredAt: -1 });
errorLogSchema.index({ source: 1, occurredAt: -1 });
errorLogSchema.index({ status: 1, occurredAt: -1 });
exports.ErrorLog = (0, mongoose_1.model)('ErrorLog', errorLogSchema);
//# sourceMappingURL=ErrorLog.js.map