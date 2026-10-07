import { Settings, type SettingsDocument } from '../models/Settings'
import { TtlCache } from './cache'

// Read on almost every request (maintenance check, dispatch rules), so keep it for a few seconds.
const cache = new TtlCache<SettingsDocument>(5000, 1)

/** The platform settings singleton (plain object), created with defaults on first use. Cached for 5 seconds. */
export function getPlatformSettings(): Promise<SettingsDocument> {
  return cache.get('platform', async () => {
    const doc =
      (await Settings.findOne({ singleton: 'platform' })) ??
      (await Settings.findOneAndUpdate({ singleton: 'platform' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }))
    return doc!.toObject() as SettingsDocument
  })
}

/** Call after settings are saved so the change applies at once. */
export function invalidateSettingsCache() {
  cache.clear()
}
