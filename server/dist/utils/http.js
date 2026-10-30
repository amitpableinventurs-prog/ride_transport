"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
exports.parsePagination = parsePagination;
exports.optionalString = optionalString;
exports.requireString = requireString;
exports.requireObjectId = requireObjectId;
exports.parseDate = parseDate;
exports.parseAmount = parseAmount;
exports.roundMoney = roundMoney;
const mongoose_1 = require("mongoose");
/** Thrown from controllers; the error handler turns it into `{ message, ...details }` with this status. */
class HttpError extends Error {
    status;
    details;
    constructor(status, message, details = {}) {
        super(message);
        this.status = status;
        this.details = details;
    }
}
exports.HttpError = HttpError;
function parsePagination(req, maxLimit = 50) {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}
function optionalString(value, maxLength = 500) {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed.slice(0, maxLength) : undefined;
}
function requireString(value, field, maxLength = 500) {
    const result = optionalString(value, maxLength);
    if (!result)
        throw new HttpError(400, `${field} is required`);
    return result;
}
function requireObjectId(value, field) {
    if (typeof value !== 'string' || !mongoose_1.Types.ObjectId.isValid(value))
        throw new HttpError(400, `${field} must be a valid id`);
    return new mongoose_1.Types.ObjectId(value);
}
/** Parses an optional ISO date query/body value; a date-only `to` covers the whole day. */
function parseDate(value, field, endOfDay = false) {
    if (value === undefined || value === '')
        return undefined;
    const date = typeof value === 'string' ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime()))
        throw new HttpError(400, `${field} must be a valid date`);
    if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value))
        date.setUTCHours(23, 59, 59, 999);
    return date;
}
function parseAmount(value, field, { min = 1, max = 100_000 } = {}) {
    const amount = typeof value === 'string' ? Number(value) : value;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < min || amount > max) {
        throw new HttpError(400, `${field} must be a number between ${min} and ${max}`);
    }
    return Math.round(amount * 100) / 100;
}
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
//# sourceMappingURL=http.js.map