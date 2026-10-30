"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportAppError = reportAppError;
exports.listErrorLogs = listErrorLogs;
exports.errorLogSummary = errorLogSummary;
exports.getErrorLog = getErrorLog;
exports.updateErrorLog = updateErrorLog;
exports.resolveSimilarErrorLogs = resolveSimilarErrorLogs;
const ErrorLog_1 = require("../models/ErrorLog");
const errorLogs_1 = require("../utils/errorLogs");
const http_1 = require("../utils/http");
const regex_1 = require("../utils/regex");
const APP_PLATFORMS = ['android', 'ios', 'web'];
/** Up to 20 flat key/value pairs; other values are stored as JSON text. */
function parseContext(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return undefined;
    const entries = Object.entries(value)
        .slice(0, 20)
        .map(([key, v]) => [key.slice(0, 50), typeof v === 'number' || typeof v === 'boolean' ? v : (typeof v === 'string' ? v : String(JSON.stringify(v))).slice(0, 500)]);
    return entries.length ? Object.fromEntries(entries) : undefined;
}
// POST /common/error-logs: a crash or error from a mobile app. The token is optional, since an app can fail before login.
// Long texts are cut rather than rejected, so a report is never lost because of its size.
async function reportAppError(req, res) {
    const body = req.body;
    if (!ErrorLog_1.APP_ERROR_SOURCES.includes(body.source)) {
        throw new http_1.HttpError(400, `source must be one of: ${ErrorLog_1.APP_ERROR_SOURCES.join(', ')}`);
    }
    const level = body.level ?? 'error';
    if (!ErrorLog_1.ERROR_LEVELS.includes(level))
        throw new http_1.HttpError(400, `level must be one of: ${ErrorLog_1.ERROR_LEVELS.join(', ')}`);
    if (body.platform !== undefined && !APP_PLATFORMS.includes(body.platform))
        throw new http_1.HttpError(400, 'platform must be android, ios or web');
    // A missing, invalid or future time (wrong device clock) becomes the time the report arrived.
    const now = new Date();
    const sentAt = typeof body.occurredAt === 'string' ? new Date(body.occurredAt) : null;
    const occurredAt = sentAt && !Number.isNaN(sentAt.getTime()) && sentAt <= now ? sentAt : now;
    const log = await ErrorLog_1.ErrorLog.create({
        source: body.source,
        level,
        message: (0, http_1.requireString)(body.message, 'message', 1000),
        stack: (0, http_1.optionalString)(body.stack, 8000),
        screen: (0, http_1.optionalString)(body.screen, 200),
        platform: body.platform,
        appVersion: (0, http_1.optionalString)(body.appVersion, 50),
        osVersion: (0, http_1.optionalString)(body.osVersion, 50),
        deviceModel: (0, http_1.optionalString)(body.deviceModel, 100),
        ...(req.appUser ? (0, errorLogs_1.appUserFields)(req.appUser) : {}),
        context: parseContext(body.context),
        ip: req.ip,
        occurredAt,
    });
    res.status(201).json({ id: log.id });
}
async function listErrorLogs(req, res) {
    const { source, level, status, platform, q } = req.query;
    const { page, limit, skip } = (0, http_1.parsePagination)(req, 100);
    const from = (0, http_1.parseDate)(req.query.from, 'from');
    const to = (0, http_1.parseDate)(req.query.to, 'to', true);
    const filter = {};
    if (source)
        filter.source = source;
    if (level)
        filter.level = level;
    if (status)
        filter.status = status;
    if (platform)
        filter.platform = platform;
    if (from || to)
        filter.occurredAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
    if (q) {
        const match = { $regex: (0, regex_1.searchRegex)(q), $options: 'i' };
        filter.$or = [{ message: match }, { screen: match }, { userName: match }, { userPhone: match }, { appVersion: match }, { deviceModel: match }];
    }
    // The list leaves out the stack trace and context, which can be long; GET /:id has them.
    const [items, total] = await Promise.all([
        ErrorLog_1.ErrorLog.find(filter).select('-stack -context').sort({ occurredAt: -1 }).skip(skip).limit(limit),
        ErrorLog_1.ErrorLog.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
}
async function errorLogSummary(_req, res) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [open, openFatal, last24h, bySource] = await Promise.all([
        ErrorLog_1.ErrorLog.countDocuments({ status: 'open' }),
        ErrorLog_1.ErrorLog.countDocuments({ status: 'open', level: 'fatal' }),
        ErrorLog_1.ErrorLog.countDocuments({ occurredAt: { $gte: since } }),
        ErrorLog_1.ErrorLog.aggregate([{ $match: { status: 'open' } }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
    ]);
    res.json({
        open,
        openFatal,
        last24h,
        openBySource: Object.fromEntries(ErrorLog_1.ERROR_SOURCES.map((s) => [s, bySource.find((b) => b._id === s)?.count ?? 0])),
    });
}
async function getErrorLog(req, res) {
    const log = await ErrorLog_1.ErrorLog.findById(req.params.id);
    if (!log)
        throw new http_1.HttpError(404, 'Error log not found');
    res.json(log);
}
async function updateErrorLog(req, res) {
    const { status } = req.body;
    if (status !== 'open' && status !== 'resolved')
        throw new http_1.HttpError(400, 'status must be open or resolved');
    const log = await ErrorLog_1.ErrorLog.findById(req.params.id);
    if (!log)
        throw new http_1.HttpError(404, 'Error log not found');
    log.status = status;
    log.resolvedAt = status === 'resolved' ? new Date() : undefined;
    log.resolvedBy = status === 'resolved' ? req.admin.name : undefined;
    await log.save();
    res.json(log);
}
// One bug usually logs the same message many times: resolve every open log with this one's source and message.
async function resolveSimilarErrorLogs(req, res) {
    const log = await ErrorLog_1.ErrorLog.findById(req.params.id);
    if (!log)
        throw new http_1.HttpError(404, 'Error log not found');
    const result = await ErrorLog_1.ErrorLog.updateMany({ source: log.source, message: log.message, status: 'open' }, { status: 'resolved', resolvedAt: new Date(), resolvedBy: req.admin.name });
    res.json({ resolved: result.modifiedCount });
}
//# sourceMappingURL=errorLogs.controller.js.map