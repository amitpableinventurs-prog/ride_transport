"use strict";
// Small in-memory cache for data that is read on almost every request but changes rarely
// (platform settings, service areas, nearby-rider counts). It lives in this process only.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TtlCache = void 0;
class TtlCache {
    ttlMs;
    maxEntries;
    entries = new Map();
    pending = new Map();
    constructor(ttlMs, maxEntries = 500) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
    }
    /** Cached value for `key`, or the result of `load()`. Concurrent callers share one load, so a burst makes one query. */
    async get(key, load) {
        const hit = this.entries.get(key);
        if (hit && hit.expiresAt > Date.now())
            return hit.value;
        const running = this.pending.get(key);
        if (running)
            return running;
        const promise = load()
            .then((value) => {
            if (this.entries.size >= this.maxEntries)
                this.entries.delete(this.entries.keys().next().value);
            this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
            return value;
        })
            .finally(() => this.pending.delete(key));
        this.pending.set(key, promise);
        return promise;
    }
    clear() {
        this.entries.clear();
    }
}
exports.TtlCache = TtlCache;
//# sourceMappingURL=cache.js.map