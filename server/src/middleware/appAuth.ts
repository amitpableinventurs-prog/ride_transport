import type { NextFunction, Request, Response } from 'express'
import { getPlatformSettings } from '../utils/settings'
import { verifyAppAccessToken, type AppUserType } from '../utils/jwt'
import { isSessionRevoked } from '../utils/sessions'
import { findAppUserById, isAppUserActive, type AppUser } from '../utils/appUsers'

/** The active app user and session of the request's Bearer token, or null. */
async function appSessionFromRequest(req: Request): Promise<{ user: AppUser; sessionId: string } | null> {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  const payload = token ? verifyAppAccessToken(token) : null
  if (!payload || (await isSessionRevoked(payload.fid))) return null

  const user = await findAppUserById(payload.ut, payload.sub)
  return user && isAppUserActive(user) ? { user, sessionId: payload.fid } : null
}

export async function requireAppAuth(req: Request, res: Response, next: NextFunction) {
  const session = await appSessionFromRequest(req)
  if (!session) {
    res.status(401).json({ message: 'Unauthorized' })
    return
  }

  req.appUser = session.user
  req.appSessionId = session.sessionId
  next()
}

/** Like requireAppAuth, but without a valid token the request goes on with no req.appUser. */
export async function optionalAppAuth(req: Request, _res: Response, next: NextFunction) {
  const session = await appSessionFromRequest(req)
  if (session) {
    req.appUser = session.user
    req.appSessionId = session.sessionId
  }
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
