import type { NextFunction, Request, Response } from 'express'
import { getPlatformSettings } from '../utils/settings'
import { verifyAppAccessToken, type AppUserType } from '../utils/jwt'
import { isSessionRevoked } from '../utils/sessions'
import { findAppUserById, isAppUserActive } from '../utils/appUsers'

export async function requireAppAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const payload = token ? verifyAppAccessToken(token) : null
  if (!payload || (await isSessionRevoked(payload.fid))) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  const user = await findAppUserById(payload.ut, payload.sub)
  if (!user || !isAppUserActive(user)) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  req.appUser = user
  req.appSessionId = payload.fid
  next()
}

/** Limits a router to one kind of app account (the customer app vs the rider app). Use after requireAppAuth. */
export function requireAppUserType(type: AppUserType) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.appUser?.type !== type) {
      res.status(403).json({ message: `This API is only available to ${type === 'driver' ? 'rider' : type} accounts` })
      return
    }
    next()
  }
}

// Settings → Maintenance mode takes the mobile apps offline without affecting the admin panel.
export async function rejectDuringMaintenance(_req: Request, res: Response, next: NextFunction) {
  const settings = await getPlatformSettings()
  if (settings.maintenanceMode) {
    res.status(503).json({ message: 'The platform is under maintenance. Please try again later.' })
    return
  }
  next()
}
