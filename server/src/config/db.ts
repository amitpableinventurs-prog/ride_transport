import mongoose from 'mongoose'
import { env } from './env'
import { idToJson } from '../utils/schemaOptions'

// Every API response keys records by `id` (the frontend and Flutter clients never
// see `_id`). Schemas that set their own toJSON (e.g. Admin) still override this.
mongoose.set('toJSON', idToJson)

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: env.dbPoolSize,
    minPoolSize: Math.min(5, env.dbPoolSize),
    // Fail fast instead of hanging every request when the database is unreachable.
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxIdleTimeMS: 60000,
  })
  // Hide the password: Atlas URIs carry credentials.
  console.log(`[db] connected to ${env.mongoUri.replace(/\/\/[^@/]*@/, '//***@')}`)

  // Super Admin has full access, so it also gets permissions added after the database was seeded (e.g. error_logs.*).
  const { Role } = await import('../models/Role')
  const { ALL_PERMISSIONS } = await import('../utils/roles')
  await Role.updateOne({ key: 'super_admin' }, { $addToSet: { permissions: { $each: ALL_PERMISSIONS } } })

  // App users sign up with a phone number only, so email moved from a plain
  // unique index to a sparse one. syncIndexes swaps the old index on existing DBs.
  const { Customer } = await import('../models/Customer')
  const { Driver } = await import('../models/Driver')
  const { TransportPartner } = await import('../models/TransportPartner')
  // Ride PINs became unique after some were given out: a shared PIN is cleared from all but the oldest account
  // (those get a new one at their next login or booking), so the unique index can be built.
  const sharedPins = await Customer.aggregate<{ ids: unknown[] }>([
    { $match: { ridePin: { $type: 'string' } } },
    { $sort: { createdAt: 1 } },
    { $group: { _id: '$ridePin', ids: { $push: '$_id' }, n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ])
  for (const { ids } of sharedPins) await Customer.updateMany({ _id: { $in: ids.slice(1) } }, { $unset: { ridePin: 1 } })
  await Promise.all([Customer.syncIndexes(), Driver.syncIndexes(), TransportPartner.syncIndexes()])

  // Partners created before partner codes existed get one (riders enter it during onboarding).
  const { generatePartnerCode } = await import('../models/TransportPartner')
  for (const partner of await TransportPartner.find({ partnerCode: { $exists: false } }).select('_id')) {
    await TransportPartner.updateOne({ _id: partner._id }, { partnerCode: generatePartnerCode() })
  }
}
