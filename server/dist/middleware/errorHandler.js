"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
const mongoose_1 = __importDefault(require("mongoose"));
const multer_1 = __importDefault(require("multer"));
const env_1 = require("../config/env");
const http_1 = require("../utils/http");
const errorLogs_1 = require("../utils/errorLogs");
function notFoundHandler(req, res) {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}
function errorHandler(err, req, res, _next) {
    if (err instanceof http_1.HttpError) {
        res.status(err.status).json({ message: err.message, ...err.details });
        return;
    }
    if (err instanceof multer_1.default.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (maximum 5 MB)' : `Upload failed: ${err.message}`;
        res.status(400).json({ message });
        return;
    }
    if (err instanceof mongoose_1.default.Error.CastError) {
        res.status(400).json({ message: `Invalid ${err.path}: ${String(err.value)}` });
        return;
    }
    if (err instanceof mongoose_1.default.Error.ValidationError) {
        res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join('; ') });
        return;
    }
    if (err.code === 11000) {
        const fields = Object.keys(err.keyValue ?? {}).join(', ');
        res.status(409).json({ message: fields ? `A record with this ${fields} already exists` : 'Duplicate record' });
        return;
    }
    if (err.type === 'entity.too.large') {
        res.status(413).json({ message: 'Request body is too large' });
        return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ message: 'Malformed JSON body' });
        return;
    }
    console.error(err);
    void (0, errorLogs_1.recordServerError)(err, req);
    const message = !env_1.env.isProduction && err instanceof Error ? err.message : 'Internal server error';
    res.status(500).json({ message });
}
//# sourceMappingURL=errorHandler.js.map