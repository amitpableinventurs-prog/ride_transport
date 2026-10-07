// Small in-memory cache for data that is read on almost every request but changes rarely
// (platform settings, service areas, nearby-rider counts). It lives in this process only.

interface Entry<T> {
  value: T
  expiresAt: number
}

export class TtlCache<T> {
  private entries = new Map<string, Entry<T>>()
  private pending = new Map<string, Promise<T>>()

  constructor(
    private ttlMs: number,
    private maxEntries = 500,
  ) {}

  /** Cached value for `key`, or the result of `load()`. Concurrent callers share one load, so a burst makes one query. */
  async get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key)
    if (hit && hit.expiresAt > Date.now()) return hit.value
    const running = this.pending.get(key)
    if (running) return running

    const promise = load()
      .then((value) => {
        if (this.entries.size >= this.maxEntries) this.entries.delete(this.entries.keys().next().value as string)
        this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs })
        return value
      })
      .finally(() => this.pending.delete(key))
    this.pending.set(key, promise)
    return promise
  }

  clear() {
    this.entries.clear()
  }
}
