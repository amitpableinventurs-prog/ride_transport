import { Settings } from '../models/Settings'

/** The platform settings singleton, created with defaults on first use. */
export async function getPlatformSettings() {
  const existing = await Settings.findOne({ singleton: 'platform' })
  if (existing) return existing
  return Settings.findOneAndUpdate({ singleton: 'platform' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true })
}
