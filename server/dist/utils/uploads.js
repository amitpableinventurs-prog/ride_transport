"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.singleUpload = singleUpload;
exports.multiUpload = multiUpload;
exports.uploadedFileUrl = uploadedFileUrl;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const multer_1 = __importDefault(require("multer"));
const env_1 = require("../config/env");
const fileSignature_1 = require("./fileSignature");
const http_1 = require("./http");
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
};
// Files are stored on local disk under random names and served at /uploads.
// For production, move this to S3 (or similar) behind signed URLs.
function storage(folder) {
    const dir = path_1.default.join(env_1.env.uploadDir, folder);
    return multer_1.default.diskStorage({
        destination: (_req, _file, cb) => {
            fs_1.default.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (_req, file, cb) => cb(null, `${crypto_1.default.randomBytes(16).toString('hex')}${ALLOWED_TYPES[file.mimetype]}`),
    });
}
/** Runs the multer middleware, then rejects (and deletes) any file whose first bytes do not match its declared type. */
function withSignatureCheck(upload) {
    return (req, res, next) => {
        upload(req, res, (err) => {
            if (err)
                return next(err);
            const files = Array.isArray(req.files) ? req.files : Object.values((req.files ?? {})).flat();
            if (req.file)
                files.push(req.file);
            const bad = files.filter((f) => !(0, fileSignature_1.matchesDeclaredType)(f));
            if (!bad.length)
                return next();
            for (const f of files)
                fs_1.default.rmSync(f.path, { force: true });
            next(new http_1.HttpError(400, `${bad[0].fieldname} is not a valid JPEG, PNG, WebP or PDF file`));
        });
    };
}
function imageFilter(imagesOnly) {
    return (_req, file, cb) => {
        const allowed = ALLOWED_TYPES[file.mimetype] && !(imagesOnly && file.mimetype === 'application/pdf');
        if (allowed)
            cb(null, true);
        else
            cb(new http_1.HttpError(400, imagesOnly ? `${file.fieldname} must be a JPEG, PNG or WebP image` : `${file.fieldname} must be a JPEG, PNG, WebP or PDF file`));
    };
}
/** Multipart middleware accepting one optional file in `field` (JPEG, PNG, WebP or PDF up to 5 MB). */
function singleUpload(folder, field, { imagesOnly = false } = {}) {
    return withSignatureCheck((0, multer_1.default)({ storage: storage(folder), limits: { fileSize: MAX_FILE_BYTES, files: 1 }, fileFilter: imageFilter(imagesOnly) }).single(field));
}
/** Multipart middleware accepting one optional file in each of `fields` (same type and size rules). */
function multiUpload(folder, fields, { imagesOnly = false } = {}) {
    return withSignatureCheck((0, multer_1.default)({
        storage: storage(folder),
        limits: { fileSize: MAX_FILE_BYTES, files: fields.length },
        fileFilter: imageFilter(imagesOnly),
    }).fields(fields.map((name) => ({ name, maxCount: 1 }))));
}
/** Public URL path of an uploaded file. */
function uploadedFileUrl(folder, file) {
    return `/uploads/${folder}/${file.filename}`;
}
//# sourceMappingURL=uploads.js.map