import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { env } from '../config/env'
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

/** Multipart middleware accepting one optional file in `field` (JPEG, PNG, WebP or PDF up to 5 MB). */
export function singleUpload(folder: UploadFolder, field: string, { imagesOnly = false } = {}) {
  return multer({
    storage: storage(folder),
    limits: { fileSize: MAX_FILE_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
      const allowed = ALLOWED_TYPES[file.mimetype] && !(imagesOnly && file.mimetype === 'application/pdf')
      if (allowed) cb(null, true)
      else cb(new HttpError(400, imagesOnly ? `${field} must be a JPEG, PNG or WebP image` : `${field} must be a JPEG, PNG, WebP or PDF file`))
    },
  }).single(field)
}

/** Public URL path of an uploaded file. */
export function uploadedFileUrl(folder: UploadFolder, file: Express.Multer.File): string {
  return `/uploads/${folder}/${file.filename}`
}
