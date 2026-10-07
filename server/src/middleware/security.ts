import type { NextFunction, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env'
import { HttpError } from '../utils/http'

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_DEPTH = 8

/** Throws when a parsed value could change a MongoDB query ({ "$ne": ... }), a dotted path or Object.prototype. */
function assertSafe(value: unknown, where: string, depth = 0): void {
  if (depth > MAX_DEPTH) throw new HttpError(400, `${where} is nested too deeply`)
  if (Array.isArray(value)) {
    for (const item of value) assertSafe(item, where, depth + 1)
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.') || key.includes('\0') || FORBIDDEN_KEYS.has(key)) {
        throw new HttpError(400, `${where} contains a field name that is not allowed`)
      }
      assertSafe(child, where, depth + 1)
    }
  }
}

/**
 * Rejects NoSQL operator injection and prototype pollution in the body, query and path parameters.
 * Query parameters must be plain strings: nested or repeated values (?status[$ne]=x, ?q=a&q=b) are refused.
 */
export function sanitizeRequest(req: Request, _res: Response, next: NextFunction) {
  assertSafe(req.body, 'Request body')
  assertSafe(req.params, 'Path parameter')
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== 'string') throw new HttpError(400, `Query parameter "${key}" must be a single text value`)
    assertSafe({ [key]: value }, 'Query')
  }
  next()
}

/** Fallback limit for every API call; login and OTP routes have their own stricter limits. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again later.' },
})

/** API answers carry tokens and personal data: never let a browser or proxy cache them. */
export function noStore(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store')
  next()
}
