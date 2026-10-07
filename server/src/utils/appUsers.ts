import type { HydratedDocument } from 'mongoose'
import { Customer, type CustomerDocument } from '../models/Customer'
import { Driver, type DriverDocument } from '../models/Driver'
import { TransportPartner, type TransportPartnerDocument } from '../models/TransportPartner'
import type { AppUserType } from './jwt'

// The three kinds of mobile-app account share one auth flow but live in
// separate collections. These helpers hide that behind a tagged union.
export type AppUser =
  | { type: 'customer'; doc: HydratedDocument<CustomerDocument> }
  | { type: 'driver'; doc: HydratedDocument<DriverDocument> }
  | { type: 'partner'; doc: HydratedDocument<TransportPartnerDocument> }

export async function findAppUserByPhone(type: AppUserType, phone: string): Promise<AppUser | null> {
  switch (type) {
    case 'customer': {
      const doc = await Customer.findOne({ phone })
      return doc ? { type, doc } : null
    }
    case 'driver': {
      const doc = await Driver.findOne({ phone })
      return doc ? { type, doc } : null
    }
    case 'partner': {
      const doc = await TransportPartner.findOne({ phone })
      return doc ? { type, doc } : null
    }
  }
}

export async function findAppUserById(type: AppUserType, id: string): Promise<AppUser | null> {
  switch (type) {
    case 'customer': {
      const doc = await Customer.findById(id)
      return doc ? { type, doc } : null
    }
    case 'driver': {
      const doc = await Driver.findById(id)
      return doc ? { type, doc } : null
    }
    case 'partner': {
      const doc = await TransportPartner.findById(id)
      return doc ? { type, doc } : null
    }
  }
}

export function isAppUserActive(user: AppUser): boolean {
  return user.doc.status === 'active'
}

// Customers and riders/drivers need a name and an emergency contact (the app's
// Profile screen). The app shows that screen while this is false.
export function isProfileComplete(user: AppUser): boolean {
  if (user.type === 'partner') return Boolean(user.doc.companyName && user.doc.ownerName)
  if (user.type === 'driver') return Boolean(user.doc.name && user.doc.photoUrl && user.doc.gender && user.doc.dateOfBirth)
  return Boolean(user.doc.name && user.doc.emergencyContact?.name && user.doc.emergencyContact?.phone)
}

export function serializeAppUser(user: AppUser) {
  return { ...user.doc.toJSON(), userType: user.type, profileComplete: isProfileComplete(user) }
}
