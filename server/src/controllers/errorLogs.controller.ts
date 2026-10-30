import type { Request, Response } from 'express'
import type { FilterQuery } from 'mongoose'
import { APP_ERROR_SOURCES, ERROR_LEVELS, ERROR_SOURCES, ErrorLog, type ErrorLogDocument } from '../models/ErrorLog'
import { appUserFields } from '../utils/errorLogs'
import { HttpError, optionalString, parseDate, parsePagination, requireString } from '../utils/http'
import { searchRegex } from '../utils/regex'

const APP_PLATFORMS = ['android', 'ios', 'web']

/** Up to 20 flat key/value pairs; other values are stored as JSON text. */
function parseContext(value: unknown): Record<string, string | number | boolean> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const entries = Object.entries(value)
    .slice(0, 20)
    .map(([key, v]) => [key.slice(0, 50), typeof v === 'number' || typeof v === 'boolean' ? v : (typeof v === 'string' ? v : String(JSON.stringify(v))).slice(0, 500)])
  return entries.length ? Object.fromEntries(entries) : undefined
}

// POST /common/error-logs: a crash or error from a mobile app. The token is optional, since an app can fail before login.
// Long texts are cut rather than rejected, so a report is never lost because of its size.
export async function reportAppError(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  if (!APP_ERROR_SOURCES.includes(body.source as (typeof APP_ERROR_SOURCES)[number])) {
    throw new HttpError(400, `source must be one of: ${APP_ERROR_SOURCES.join(', ')}`)
  }
  const level = body.level ?? 'error'
  if (!ERROR_LEVELS.includes(level as (typeof ERROR_LEVELS)[number])) throw new HttpError(400, `level must be one of: ${ERROR_LEVELS.join(', ')}`)
  if (body.platform !== undefined && !APP_PLATFORMS.includes(body.platform as string)) throw new HttpError(400, 'platform must be android, ios or web')

  // A missing, invalid or future time (wrong device clock) becomes the time the report arrived.
  const now = new Date()
  const sentAt = typeof body.occurredAt === 'string' ? new Date(body.occurredAt) : null
  const occurredAt = sentAt && !Number.isNaN(sentAt.getTime()) && sentAt <= now ? sentAt : now

  const log = await ErrorLog.create({
    source: body.source,
    level,
    message: requireString(body.message, 'message', 1000),
    stack: optionalString(body.stack, 8000),
    screen: optionalString(body.screen, 200),
    platform: body.platform,
    appVersion: optionalString(body.appVersion, 50),
    osVersion: optionalString(body.osVersion, 50),
    deviceModel: optionalString(body.deviceModel, 100),
    ...(req.appUser ? appUserFields(req.appUser) : {}),
    context: parseContext(body.context),
    ip: req.ip,
    occurredAt,
  })
  res.status(201).json({ id: log.id })
}

export async function listErrorLogs(req: Request, res: Response) {
  const { source, level, status, platform, q } = req.query as { source?: string; level?: string; status?: string; platform?: string; q?: string }
  const { page, limit, skip } = parsePagination(req, 100)
  const from = parseDate(req.query.from, 'from')
  const to = parseDate(req.query.to, 'to', true)

  const filter: FilterQuery<ErrorLogDocument> = {}
  if (source) filter.source = source as ErrorLogDocument['source']
  if (level) filter.level = level as ErrorLogDocument['level']
  if (status) filter.status = status as ErrorLogDocument['status']
  if (platform) filter.platform = platform as ErrorLogDocument['platform']
  if (from || to) filter.occurredAt = { ...(from && { $gte: from }), ...(to && { $lte: to }) }
  if (q) {
    const match = { $regex: searchRegex(q), $options: 'i' }
    filter.$or = [{ message: match }, { screen: match }, { userName: match }, { userPhone: match }, { appVersion: match }, { deviceModel: match }]
  }

  // The list leaves out the stack trace and context, which can be long; GET /:id has them.
  const [items, total] = await Promise.all([
    ErrorLog.find(filter).select('-stack -context').sort({ occurredAt: -1 }).skip(skip).limit(limit),
    ErrorLog.countDocuments(filter),
  ])
  res.json({ items, total, page, limit })
}

export async function errorLogSummary(_req: Request, res: Response) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [open, openFatal, last24h, bySource] = await Promise.all([
    ErrorLog.countDocuments({ status: 'open' }),
    ErrorLog.countDocuments({ status: 'open', level: 'fatal' }),
    ErrorLog.countDocuments({ occurredAt: { $gte: since } }),
    ErrorLog.aggregate<{ _id: string; count: number }>([{ $match: { status: 'open' } }, { $group: { _id: '$source', count: { $sum: 1 } } }]),
  ])
  res.json({
    open,
    openFatal,
    last24h,
    openBySource: Object.fromEntries(ERROR_SOURCES.map((s) => [s, bySource.find((b) => b._id === s)?.count ?? 0])),
  })
}

export async function getErrorLog(req: Request, res: Response) {
  const log = await ErrorLog.findById(req.params.id)
  if (!log) throw new HttpError(404, 'Error log not found')
  res.json(log)
}

export async function updateErrorLog(req: Request, res: Response) {
  const { status } = req.body as { status?: unknown }
  if (status !== 'open' && status !== 'resolved') throw new HttpError(400, 'status must be open or resolved')
  const log = await ErrorLog.findById(req.params.id)
  if (!log) throw new HttpError(404, 'Error log not found')

  log.status = status
  log.resolvedAt = status === 'resolved' ? new Date() : undefined
  log.resolvedBy = status === 'resolved' ? req.admin!.name : undefined
  await log.save()
  res.json(log)
}

// One bug usually logs the same message many times: resolve every open log with this one's source and message.
export async function resolveSimilarErrorLogs(req: Request, res: Response) {
  const log = await ErrorLog.findById(req.params.id)
  if (!log) throw new HttpError(404, 'Error log not found')

  const result = await ErrorLog.updateMany(
    { source: log.source, message: log.message, status: 'open' },
    { status: 'resolved', resolvedAt: new Date(), resolvedBy: req.admin!.name },
  )
  res.json({ resolved: result.modifiedCount })
}
