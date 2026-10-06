import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import { env } from '../config/env'

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ message: `Invalid ${err.path}: ${String(err.value)}` })
    return
  }
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join('; ') })
    return
  }
  if ((err as { code?: number }).code === 11000) {
    const fields = Object.keys((err as { keyValue?: Record<string, unknown> }).keyValue ?? {}).join(', ')
    res.status(409).json({ message: fields ? `A record with this ${fields} already exists` : 'Duplicate record' })
    return
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ message: 'Malformed JSON body' })
    return
  }

  console.error(err)
  const message = !env.isProduction && err instanceof Error ? err.message : 'Internal server error'
  res.status(500).json({ message })
}
