import type { HydratedDocument } from 'mongoose'
import type { AdminDocument } from '../models/Admin'
import type { AppUser } from '../utils/appUsers'

declare global {
  namespace Express {
    interface Request {
      admin?: HydratedDocument<AdminDocument>
      adminPermissions?: string[]
      adminSessionId?: string
      appUser?: AppUser
      appSessionId?: string
    }
  }
}

export {}
