// Google Maps Platform (server key): road routes, reverse geocoding and place search.
// Without GOOGLE_MAPS_API_KEY, or when Google fails, callers fall back to the straight-line
// estimate (utils/geo) and the customer's own places, so trips never block on the maps provider.
import { env } from '../config/env'
import { TtlCache } from './cache'
import { routeDistanceKm, travelMinutes, type LatLng } from './geo'

export interface RouteMetrics {
  distanceKm: number
  durationMin: number
}

export interface MapsPlace extends LatLng {
  name: string
  address: string
  placeId: string
}

const REQUEST_TIMEOUT_MS = 4000
// The Routes API takes the origin, the destination and up to 25 stops in between.
const MAX_INTERMEDIATES = 25

// An estimate prices every category from one route, and repeated lookups of the same points are common.
const routeCache = new TtlCache<RouteMetrics | null>(10 * 60_000, 2000)
const addressCache = new TtlCache<string | null>(60 * 60_000, 2000)
const searchCache = new TtlCache<MapsPlace[]>(10 * 60_000, 1000)

const mapsEnabled = () => Boolean(env.googleMapsApiKey)
const pointKey = (p: LatLng, digits: number) => `${p.lat.toFixed(digits)},${p.lng.toFixed(digits)}`
const latLng = (p: LatLng) => ({ latLng: { latitude: p.lat, longitude: p.lng } })

// Throws on any failure, so the caches below keep only real answers and the next call retries.
async function googleFetch<T>(label: string, url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`[maps:${label}] ${response.status} ${(await response.text()).slice(0, 500)}`)
  return (await response.json()) as T
}

function logMapsError(err: unknown) {
  console.error(err instanceof Error ? err.message : err)
}

function postJson(fieldMask: string, body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.googleMapsApiKey, 'X-Goog-FieldMask': fieldMask },
    body: JSON.stringify(body),
  }
}

// https://developers.google.com/maps/documentation/routes/compute_route_directions
async function googleRoute(points: LatLng[]): Promise<RouteMetrics | null> {
  const data = await googleFetch<{ routes?: { distanceMeters?: number; duration?: string }[] }>(
    'route',
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    postJson('routes.distanceMeters,routes.duration', {
      origin: { location: latLng(points[0]) },
      destination: { location: latLng(points[points.length - 1]) },
      intermediates: points.slice(1, -1).map((p) => ({ location: latLng(p) })),
      travelMode: 'DRIVE',
      languageCode: 'en-IN',
      units: 'METRIC',
    }),
  )
  const route = data.routes?.[0]
  if (!route?.distanceMeters) return null
  const seconds = Number.parseFloat(route.duration ?? '0')
  return {
    distanceKm: Math.round(route.distanceMeters / 100) / 10,
    durationMin: Math.max(1, Math.ceil(seconds / 60)),
  }
}

/** Road distance and drive time through the points: Google when configured, else the straight-line estimate. */
export async function routeMetrics(points: LatLng[]): Promise<RouteMetrics> {
  if (mapsEnabled() && points.length >= 2 && points.length <= MAX_INTERMEDIATES + 2) {
    const road = await routeCache.get(points.map((p) => pointKey(p, 5)).join('|'), () => googleRoute(points)).catch(logMapsError)
    if (road) return road
  }
  const distanceKm = routeDistanceKm(points)
  return { distanceKm, durationMin: travelMinutes(distanceKm) }
}

/** Drive time in minutes between two points (one Google request; use utils/geo etaMinutes for frequent updates). */
export async function roadEtaMinutes(from: LatLng, to: LatLng): Promise<number> {
  return (await routeMetrics([from, to])).durationMin
}

// https://developers.google.com/maps/documentation/geocoding/requests-reverse-geocoding
async function googleAddress(point: LatLng): Promise<string | null> {
  const params = new URLSearchParams({ latlng: `${point.lat},${point.lng}`, key: env.googleMapsApiKey, language: 'en', region: 'in' })
  const data = await googleFetch<{ status?: string; results?: { formatted_address?: string }[] }>(
    'geocode',
    `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
  )
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') throw new Error(`[maps:geocode] ${data.status}`)
  return data.results?.[0]?.formatted_address ?? null
}

/** Street address at a point, or null when Google is not configured, fails or has none. */
export async function reverseGeocodeAddress(point: LatLng): Promise<string | null> {
  if (!mapsEnabled()) return null
  // ~10 m cells, so a pin dragged a little reuses the lookup.
  return addressCache.get(pointKey(point, 4), () => googleAddress(point)).catch((err) => (logMapsError(err), null))
}

// https://developers.google.com/maps/documentation/places/web-service/text-search
async function googleTextSearch(query: string, near: LatLng | null, limit: number): Promise<MapsPlace[]> {
  const data = await googleFetch<{
    places?: { id: string; displayName?: { text?: string }; formattedAddress?: string; location?: { latitude: number; longitude: number } }[]
  }>(
    'places',
    'https://places.googleapis.com/v1/places:searchText',
    postJson('places.id,places.displayName,places.formattedAddress,places.location', {
      textQuery: query,
      languageCode: 'en',
      regionCode: 'IN',
      pageSize: limit,
      ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50_000 } } } : {}),
    }),
  )
  return (data.places ?? [])
    .filter((p) => p.location)
    .map((p) => ({
      placeId: p.id,
      name: p.displayName?.text ?? p.formattedAddress ?? '',
      address: p.formattedAddress ?? p.displayName?.text ?? '',
      lat: p.location!.latitude,
      lng: p.location!.longitude,
    }))
}

/** Places matching the text, biased to `near` when given. Empty when Google is not configured or fails. */
export async function searchPlacesText(query: string, near: LatLng | null, limit = 8): Promise<MapsPlace[]> {
  if (!mapsEnabled()) return []
  const key = `${query.toLowerCase()}|${near ? pointKey(near, 2) : ''}|${limit}`
  return searchCache.get(key, () => googleTextSearch(query, near, limit)).catch((err) => (logMapsError(err), []))
}
