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
  console.log(`[db] connected to ${env.mongoUri}`)

  // App users sign up with a phone number only, so email moved from a plain
  // unique index to a sparse one. syncIndexes swaps the old index on existing DBs.
  const { Customer } = await import('../models/Customer')
  const { Driver } = await import('../models/Driver')
  const { TransportPartner } = await import('../models/TransportPartner')
  await Promise.all([Customer.syncIndexes(), Driver.syncIndexes(), TransportPartner.syncIndexes()])

  // Partners created before partner codes existed get one (riders enter it during onboarding).
  const { generatePartnerCode } = await import('../models/TransportPartner')
  for (const partner of await TransportPartner.find({ partnerCode: { $exists: false } }).select('_id')) {
    await TransportPartner.updateOne({ _id: partner._id }, { partnerCode: generatePartnerCode() })
  }
}
