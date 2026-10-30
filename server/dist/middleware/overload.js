"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.overloadGuard = overloadGuard;
exports.requestTimeout = requestTimeout;
exports.overloadStats = overloadStats;
exports.perUserLimiter = perUserLimiter;
const perf_hooks_1 = require("perf_hooks");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const env_1 = require("../config/env");
// ---- Overload protection ----
// When the server falls behind (the event loop is delayed) it is better to turn some requests away quickly with
// 503 + Retry-After than to queue everything until it all times out and the process runs out of memory.
const SAMPLE_MS = 20;
const loopDelay = (0, perf_hooks_1.monitorEventLoopDelay)({ resolution: SAMPLE_MS });
loopDelay.enable();
let inFlight = 0;
/** Extra delay of the event loop in ms. The sampler's own timer interval is part of every sample, so it is subtracted. */
// Reading the histogram is not free, so it is read at most four times a second.
let lagReadAt = 0;
let lagValue = 0;
const currentLagMs = () => {
    const now = Date.now();
    if (now - lagReadAt > 250) {
        lagReadAt = now;
        lagValue = Math.max(0, loopDelay.mean / 1e6 - SAMPLE_MS);
    }
    return lagValue;
};
function overloadGuard(req, res, next) {
    if (req.path.startsWith('/health'))
        return next();
    const lagMs = currentLagMs();
    if (lagMs > env_1.env.maxEventLoopLagMs || inFlight >= env_1.env.maxConcurrentRequests) {
        res.setHeader('Retry-After', '3');
        res.status(503).json({ message: 'The server is busy right now. Please try again in a few seconds.' });
        return;
    }
    inFlight++;
    let done = false;
    const finish = () => {
        if (done)
            return;
        done = true;
        inFlight--;
    };
    res.on('finish', finish);
    res.on('close', finish);
    next();
}
// Reset the sampled delay every few seconds so one old spike does not keep the guard closed.
setInterval(() => loopDelay.reset(), 5000).unref();
/** Gives up on a request that runs too long, so a stuck query cannot hold a connection forever. */
function requestTimeout(req, res, next) {
    if (req.path.startsWith('/uploads') || req.path.startsWith('/api-docs'))
        return next();
    const timer = setTimeout(() => {
        if (!res.headersSent)
            res.status(503).json({ message: 'The request took too long. Please try again.' });
    }, env_1.env.requestTimeoutMs);
    timer.unref();
    const clear = () => clearTimeout(timer);
    res.on('finish', clear);
    res.on('close', clear);
    next();
}
function overloadStats() {
    return { inFlight, eventLoopLagMs: Math.round(currentLagMs() * 10) / 10 };
}
// ---- Per-user limit for the mobile apps ----
// Many phones share one carrier IP address, so the IP limit alone would block innocent users.
// Signed-in app users are limited by their own account instead.
function perUserLimiter(limit, windowMs = 60_000, message = 'Too many requests. Please slow down.') {
    const options = {
        windowMs,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message },
        // Runs after requireAppAuth, so the account is known. Falls back to a single shared bucket, never to the IP.
        keyGenerator: (req) => `user:${req.appUser?.type ?? 'x'}:${req.appUser?.doc.id ?? 'anonymous'}`,
        validate: false,
    };
    return (0, express_rate_limit_1.default)(options);
}
//# sourceMappingURL=overload.js.map