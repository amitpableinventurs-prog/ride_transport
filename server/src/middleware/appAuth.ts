import type { NextFunction, Request, Response } from 'express'
import { Settings } from '../models/Settings'
import { verifyAppAccessToken } from '../utils/jwt'
import { findAppUserById, isAppUserActive } from '../utils/appUsers'

export async function requireAppAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const payload = token ? verifyAppAccessToken(token) : null
  if (!payload) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const user = await findAppUserById(payload.ut, payload.sub)
  if (!user || !isAppUserActive(user)) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  req.appUser = user
  next()
}

// Settings → Maintenance mode takes the mobile apps offline without affecting the admin panel.
export async function rejectDuringMaintenance(_req: Request, res: Response, next: NextFunction) {
  const settings = await Settings.findOne({ singleton: 'platform' }).select('maintenanceMode')
  if (settings?.maintenanceMode) {
    res.status(503).json({ message: 'The platform is under maintenance. Please try again later.' })
    return
  }
  next()
}
