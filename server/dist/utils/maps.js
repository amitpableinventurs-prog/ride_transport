"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeMetrics = routeMetrics;
exports.roadEtaMinutes = roadEtaMinutes;
exports.reverseGeocodeAddress = reverseGeocodeAddress;
exports.searchPlacesText = searchPlacesText;
// Google Maps Platform (server key): road routes, reverse geocoding and place search.
// Without GOOGLE_MAPS_API_KEY, or when Google fails, callers fall back to the straight-line
// estimate (utils/geo) and the customer's own places, so trips never block on the maps provider.
const env_1 = require("../config/env");
const cache_1 = require("./cache");
const geo_1 = require("./geo");
const REQUEST_TIMEOUT_MS = 4000;
// The Routes API takes the origin, the destination and up to 25 stops in between.
const MAX_INTERMEDIATES = 25;
// An estimate prices every category from one route, and repeated lookups of the same points are common.
const routeCache = new cache_1.TtlCache(10 * 60_000, 2000);
const addressCache = new cache_1.TtlCache(60 * 60_000, 2000);
const searchCache = new cache_1.TtlCache(10 * 60_000, 1000);
const mapsEnabled = () => Boolean(env_1.env.googleMapsApiKey);
const pointKey = (p, digits) => `${p.lat.toFixed(digits)},${p.lng.toFixed(digits)}`;
const latLng = (p) => ({ latLng: { latitude: p.lat, longitude: p.lng } });
// Throws on any failure, so the caches below keep only real answers and the next call retries.
async function googleFetch(label, url, init = {}) {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok)
        throw new Error(`[maps:${label}] ${response.status} ${(await response.text()).slice(0, 500)}`);
    return (await response.json());
}
function logMapsError(err) {
    console.error(err instanceof Error ? err.message : err);
}
function postJson(fieldMask, body) {
    return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env_1.env.googleMapsApiKey, 'X-Goog-FieldMask': fieldMask },
        body: JSON.stringify(body),
    };
}
// https://developers.google.com/maps/documentation/routes/compute_route_directions
async function googleRoute(points) {
    const data = await googleFetch('route', 'https://routes.googleapis.com/directions/v2:computeRoutes', postJson('routes.distanceMeters,routes.duration', {
        origin: { location: latLng(points[0]) },
        destination: { location: latLng(points[points.length - 1]) },
        intermediates: points.slice(1, -1).map((p) => ({ location: latLng(p) })),
        travelMode: 'DRIVE',
        languageCode: 'en-IN',
        units: 'METRIC',
    }));
    const route = data.routes?.[0];
    if (!route?.distanceMeters)
        return null;
    const seconds = Number.parseFloat(route.duration ?? '0');
    return {
        distanceKm: Math.round(route.distanceMeters / 100) / 10,
        durationMin: Math.max(1, Math.ceil(seconds / 60)),
    };
}
/** Road distance and drive time through the points: Google when configured, else the straight-line estimate. */
async function routeMetrics(points) {
    if (mapsEnabled() && points.length >= 2 && points.length <= MAX_INTERMEDIATES + 2) {
        const road = await routeCache.get(points.map((p) => pointKey(p, 5)).join('|'), () => googleRoute(points)).catch(logMapsError);
        if (road)
            return road;
    }
    const distanceKm = (0, geo_1.routeDistanceKm)(points);
    return { distanceKm, durationMin: (0, geo_1.travelMinutes)(distanceKm) };
}
/** Drive time in minutes between two points (one Google request; use utils/geo etaMinutes for frequent updates). */
async function roadEtaMinutes(from, to) {
    return (await routeMetrics([from, to])).durationMin;
}
// https://developers.google.com/maps/documentation/geocoding/requests-reverse-geocoding
async function googleAddress(point) {
    const params = new URLSearchParams({ latlng: `${point.lat},${point.lng}`, key: env_1.env.googleMapsApiKey, language: 'en', region: 'in' });
    const data = await googleFetch('geocode', `https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS')
        throw new Error(`[maps:geocode] ${data.status}`);
    return data.results?.[0]?.formatted_address ?? null;
}
/** Street address at a point, or null when Google is not configured, fails or has none. */
async function reverseGeocodeAddress(point) {
    if (!mapsEnabled())
        return null;
    // ~10 m cells, so a pin dragged a little reuses the lookup.
    return addressCache.get(pointKey(point, 4), () => googleAddress(point)).catch((err) => (logMapsError(err), null));
}
// https://developers.google.com/maps/documentation/places/web-service/text-search
async function googleTextSearch(query, near, limit) {
    const data = await googleFetch('places', 'https://places.googleapis.com/v1/places:searchText', postJson('places.id,places.displayName,places.formattedAddress,places.location', {
        textQuery: query,
        languageCode: 'en',
        regionCode: 'IN',
        pageSize: limit,
        ...(near ? { locationBias: { circle: { center: { latitude: near.lat, longitude: near.lng }, radius: 50_000 } } } : {}),
    }));
    return (data.places ?? [])
        .filter((p) => p.location)
        .map((p) => ({
        placeId: p.id,
        name: p.displayName?.text ?? p.formattedAddress ?? '',
        address: p.formattedAddress ?? p.displayName?.text ?? '',
        lat: p.location.latitude,
        lng: p.location.longitude,
    }));
}
/** Places matching the text, biased to `near` when given. Empty when Google is not configured or fails. */
async function searchPlacesText(query, near, limit = 8) {
    if (!mapsEnabled())
        return [];
    const key = `${query.toLowerCase()}|${near ? pointKey(near, 2) : ''}|${limit}`;
    return searchCache.get(key, () => googleTextSearch(query, near, limit)).catch((err) => (logMapsError(err), []));
}
//# sourceMappingURL=maps.js.map