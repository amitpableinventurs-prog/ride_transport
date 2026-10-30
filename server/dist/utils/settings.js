"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformSettings = getPlatformSettings;
exports.invalidateSettingsCache = invalidateSettingsCache;
const Settings_1 = require("../models/Settings");
const cache_1 = require("./cache");
// Read on almost every request (maintenance check, dispatch rules), so keep it for a few seconds.
const cache = new cache_1.TtlCache(5000, 1);
/** The platform settings singleton (plain object), created with defaults on first use. Cached for 5 seconds. */
function getPlatformSettings() {
    return cache.get('platform', async () => {
        const doc = (await Settings_1.Settings.findOne({ singleton: 'platform' })) ??
            (await Settings_1.Settings.findOneAndUpdate({ singleton: 'platform' }, {}, { upsert: true, new: true, setDefaultsOnInsert: true }));
        return doc.toObject();
    });
}
/** Call after settings are saved so the change applies at once. */
function invalidateSettingsCache() {
    cache.clear();
}
//# sourceMappingURL=settings.js.map