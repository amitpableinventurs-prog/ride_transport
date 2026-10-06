import mongoose from 'mongoose'
import { env } from './env'
import { idToJson } from '../utils/schemaOptions'

// Every API response keys records by `id` (the frontend and Flutter clients never
// see `_id`). Schemas that set their own toJSON (e.g. Admin) still override this.
mongoose.set('toJSON', idToJson)

export async function connectDb(): Promise<void> {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.mongoUri)
  console.log(`[db] connected to ${env.mongoUri}`)

  // App users sign up with a phone number only, so email moved from a plain
  // unique index to a sparse one. syncIndexes swaps the old index on existing DBs.
  const { Customer } = await import('../models/Customer')
  const { Driver } = await import('../models/Driver')
  const { TransportPartner } = await import('../models/TransportPartner')
  await Promise.all([Customer.syncIndexes(), Driver.syncIndexes(), TransportPartner.syncIndexes()])
}
