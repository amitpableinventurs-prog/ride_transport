import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { env } from '../config/env'
import type { RequestHandler } from 'express'
import { matchesDeclaredType } from './fileSignature'
import { HttpError } from './http'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
}

export type UploadFolder = 'documents' | 'selfies' | 'goods' | 'pod' | 'profile'

// Files are stored on local disk under random names and served at /uploads.
// For production, move this to S3 (or similar) behind signed URLs.
function storage(folder: UploadFolder) {
  const dir = path.join(env.uploadDir, folder)
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (_req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${ALLOWED_TYPES[file.mimetype]}`),
  })
}

/** Runs the multer middleware, then rejects (and deletes) any file whose first bytes do not match its declared type. */
function withSignatureCheck(upload: RequestHandler): RequestHandler {
  return (req, res, next) => {
    upload(req, res, (err?: unknown) => {
      if (err) return next(err)
      const files = Array.isArray(req.files) ? req.files : Object.values((req.files ?? {}) as Record<string, Express.Multer.File[]>).flat()
      if (req.file) files.push(req.file)
      const bad = files.filter((f) => !matchesDeclaredType(f))
      if (!bad.length) return next()
      for (const f of files) fs.rmSync(f.path, { force: true })
      next(new HttpError(400, `${bad[0].fieldname} is not a valid JPEG, PNG, WebP or PDF file`))
    })
  }
}

function imageFilter(imagesOnly: boolean): multer.Options['fileFilter'] {
  return (_req, file, cb) => {
    const allowed = ALLOWED_TYPES[file.mimetype] && !(imagesOnly && file.mimetype === 'application/pdf')
    if (allowed) cb(null, true)
    else cb(new HttpError(400, imagesOnly ? `${file.fieldname} must be a JPEG, PNG or WebP image` : `${file.fieldname} must be a JPEG, PNG, WebP or PDF file`))
  }
}

/** Multipart middleware accepting one optional file in `field` (JPEG, PNG, WebP or PDF up to 5 MB). */
export function singleUpload(folder: UploadFolder, field: string, { imagesOnly = false } = {}): RequestHandler {
  return withSignatureCheck(multer({ storage: storage(folder), limits: { fileSize: MAX_FILE_BYTES, files: 1 }, fileFilter: imageFilter(imagesOnly) }).single(field))
}

/** Multipart middleware accepting one optional file in each of `fields` (same type and size rules). */
export function multiUpload(folder: UploadFolder, fields: string[], { imagesOnly = false } = {}): RequestHandler {
  return withSignatureCheck(
    multer({
    storage: storage(folder),
    limits: { fileSize: MAX_FILE_BYTES, files: fields.length },
    fileFilter: imageFilter(imagesOnly),
    }).fields(fields.map((name) => ({ name, maxCount: 1 }))),
  )
}

/** Public URL path of an uploaded file. */
export function uploadedFileUrl(folder: UploadFolder, file: Express.Multer.File): string {
  return `/uploads/${folder}/${file.filename}`
}
