import type { Request, Response } from 'express'
import { AuditLog } from '../models/AuditLog'

export async function listAuditLogs(_req: Request, res: Response) {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(500)
  res.json(logs)
}
