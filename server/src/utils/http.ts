import type { Request } from 'express'
import { Types } from 'mongoose'

/** Thrown from controllers; the error handler turns it into `{ message, ...details }` with this status. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

export function parsePagination(req: Request, maxLimit = 50) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
  const limit = Math.min(maxLimit, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
  return { page, limit, skip: (page - 1) * limit }
}

export function optionalString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : undefined
}

export function requireString(value: unknown, field: string, maxLength = 500): string {
  const result = optionalString(value, maxLength)
  if (!result) throw new HttpError(400, `${field} is required`)
  return result
}

export function requireObjectId(value: unknown, field: string): Types.ObjectId {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value)) throw new HttpError(400, `${field} must be a valid id`)
  return new Types.ObjectId(value)
}

/** Parses an optional ISO date query/body value; a date-only `to` covers the whole day. */
export function parseDate(value: unknown, field: string, endOfDay = false): Date | undefined {
  if (value === undefined || value === '') return undefined
  const date = typeof value === 'string' ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) throw new HttpError(400, `${field} must be a valid date`)
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value as string)) date.setUTCHours(23, 59, 59, 999)
  return date
}

export function parseAmount(value: unknown, field: string, { min = 1, max = 100_000 } = {}): number {
  const amount = typeof value === 'string' ? Number(value) : value
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < min || amount > max) {
    throw new HttpError(400, `${field} must be a number between ${min} and ${max}`)
  }
  return Math.round(amount * 100) / 100
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
