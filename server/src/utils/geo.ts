import type { HydratedDocument } from 'mongoose'
import { ServiceArea, type ServiceAreaDocument } from '../models/ServiceArea'
import { TtlCache } from './cache'
import { HttpError } from './http'

// Service areas change rarely and are read on almost every app request.
const areasCache = new TtlCache<HydratedDocument<ServiceAreaDocument>[]>(15_000, 1)

export interface LatLng {
  lat: number
  lng: number
}

export interface Place extends LatLng {
  address?: string
}

// No maps provider is wired in yet, so road distance is estimated from the
// straight-line distance and duration from an average city speed.
const ROAD_FACTOR = 1.3
const AVG_CITY_SPEED_KMPH = 25

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

/** Estimated road distance along a route of points, in km (1 decimal). */
export function routeDistanceKm(points: LatLng[]): number {
  let km = 0
  for (let i = 1; i < points.length; i++) km += haversineKm(points[i - 1], points[i])
  return Math.round(km * ROAD_FACTOR * 10) / 10
}

export function travelMinutes(roadKm: number): number {
  return Math.max(1, Math.ceil((roadKm / AVG_CITY_SPEED_KMPH) * 60))
}

/** ETA in minutes between two points. */
export function etaMinutes(from: LatLng, to: LatLng): number {
  return travelMinutes(routeDistanceKm([from, to]))
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

export function parseLatLng(lat: unknown, lng: unknown): LatLng | null {
  const la = toNumber(lat)
  const ln = toNumber(lng)
  if (la === null || ln === null || la < -90 || la > 90 || ln < -180 || ln > 180) return null
  return { lat: la, lng: ln }
}

/** Validates `{ lat, lng, address? }` from a request body; throws 400 when invalid. */
export function parsePlace(value: unknown, field: string): Place {
  const raw = (value ?? {}) as { lat?: unknown; lng?: unknown; address?: unknown }
  const point = parseLatLng(raw.lat, raw.lng)
  if (!point) throw new HttpError(400, `${field} needs valid lat and lng`)
  const address = typeof raw.address === 'string' ? raw.address.trim().slice(0, 300) : undefined
  return { ...point, ...(address ? { address } : {}) }
}

/**
 * The active service area (city / zone) that contains a point. Areas are
 * geofenced as circles; when several overlap the closest center wins.
 */
export async function findServiceArea(point: LatLng) {
  const areas = await areasCache.get('active', () => ServiceArea.find({ status: 'active' }))
  let best: (typeof areas)[number] | null = null
  let bestDistance = Infinity
  for (const area of areas) {
    const { centerLat, centerLng, radiusKm } = area.geofence ?? {}
    if (centerLat == null || centerLng == null || radiusKm == null) continue
    const distance = haversineKm(point, { lat: centerLat, lng: centerLng })
    if (distance <= radiusKm && distance < bestDistance) {
      best = area
      bestDistance = distance
    }
  }
  return best
}

/** Latitude / longitude limits of the square around a point, for an index-friendly pre-filter before the exact distance check. */
export function boundingBox(point: LatLng, radiusKm: number) {
  const dLat = radiusKm / 111
  const dLng = radiusKm / (111 * Math.max(0.1, Math.cos((point.lat * Math.PI) / 180)))
  return { minLat: point.lat - dLat, maxLat: point.lat + dLat, minLng: point.lng - dLng, maxLng: point.lng + dLng }
}
