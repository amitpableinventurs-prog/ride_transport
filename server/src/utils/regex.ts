const MAX_SEARCH_LENGTH = 100

/** Escapes text so it can be used inside a RegExp / $regex as plain characters (no regex injection or ReDoS). */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Search box text turned into a safe $regex value: trimmed, length-capped and escaped. */
export function searchRegex(value: string): string {
  return escapeRegex(value.trim().slice(0, MAX_SEARCH_LENGTH))
}
