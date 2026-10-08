import { apiClient } from './client'

/** Uploaded files live at /uploads on the API host, outside the /api/v1/admin prefix. */
export function fileHref(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  const base = apiClient.defaults.baseURL ?? ''
  const origin = /^https?:\/\/[^/]+/i.exec(base)?.[0] ?? ''
  return `${origin}${url}`
}

export function isPdf(url: string): boolean {
  return /\.pdf($|\?)/i.test(url)
}
