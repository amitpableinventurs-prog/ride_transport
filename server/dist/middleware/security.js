"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiLimiter = void 0;
exports.sanitizeRequest = sanitizeRequest;
exports.noStore = noStore;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../config/env");
const http_1 = require("../utils/http");
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 8;
/** Throws when a parsed value could change a MongoDB query ({ "$ne": ... }), a dotted path or Object.prototype. */
function assertSafe(value, where, depth = 0) {
    if (depth > MAX_DEPTH)
        throw new http_1.HttpError(400, `${where} is nested too deeply`);
    if (Array.isArray(value)) {
        for (const item of value)
            assertSafe(item, where, depth + 1);
        return;
    }
    if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            if (key.startsWith('$') || key.includes('.') || key.includes('\0') || FORBIDDEN_KEYS.has(key)) {
                throw new http_1.HttpError(400, `${where} contains a field name that is not allowed`);
            }
            assertSafe(child, where, depth + 1);
        }
    }
}
/**
 * Rejects NoSQL operator injection and prototype pollution in the body, query and path parameters.
 * Query parameters must be plain strings: nested or repeated values (?status[$ne]=x, ?q=a&q=b) are refused.
 */
function sanitizeRequest(req, _res, next) {
    assertSafe(req.body, 'Request body');
    assertSafe(req.params, 'Path parameter');
    for (const [key, value] of Object.entries(req.query)) {
        if (typeof value !== 'string')
            throw new http_1.HttpError(400, `Query parameter "${key}" must be a single text value`);
        assertSafe({ [key]: value }, 'Query');
    }
    next();
}
/** Fallback limit for every API call; login and OTP routes have their own stricter limits. */
exports.apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: env_1.env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down and try again later.' },
});
/** API answers carry tokens and personal data: never let a browser or proxy cache them. */
function noStore(_req, res, next) {
    res.setHeader('Cache-Control', 'no-store');
    next();
}
//# sourceMappingURL=security.js.map