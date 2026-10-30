"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineKm = haversineKm;
exports.routeDistanceKm = routeDistanceKm;
exports.travelMinutes = travelMinutes;
exports.etaMinutes = etaMinutes;
exports.parseLatLng = parseLatLng;
exports.parsePlace = parsePlace;
exports.findServiceArea = findServiceArea;
exports.boundingBox = boundingBox;
const ServiceArea_1 = require("../models/ServiceArea");
const cache_1 = require("./cache");
const http_1 = require("./http");
// Service areas change rarely and are read on almost every app request.
const areasCache = new cache_1.TtlCache(15_000, 1);
// Fallback when Google Maps (utils/maps) is not configured or fails, and for frequent ETA updates:
// road distance estimated from the straight-line distance, duration from an average city speed.
const ROAD_FACTOR = 1.3;
const AVG_CITY_SPEED_KMPH = 25;
function haversineKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}
/** Estimated road distance along a route of points, in km (1 decimal). */
function routeDistanceKm(points) {
    let km = 0;
    for (let i = 1; i < points.length; i++)
        km += haversineKm(points[i - 1], points[i]);
    return Math.round(km * ROAD_FACTOR * 10) / 10;
}
function travelMinutes(roadKm) {
    return Math.max(1, Math.ceil((roadKm / AVG_CITY_SPEED_KMPH) * 60));
}
/** ETA in minutes between two points. */
function etaMinutes(from, to) {
    return travelMinutes(routeDistanceKm([from, to]));
}
function toNumber(value) {
    const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
}
function parseLatLng(lat, lng) {
    const la = toNumber(lat);
    const ln = toNumber(lng);
    if (la === null || ln === null || la < -90 || la > 90 || ln < -180 || ln > 180)
        return null;
    return { lat: la, lng: ln };
}
/** Validates `{ lat, lng, address? }` from a request body; throws 400 when invalid. */
function parsePlace(value, field) {
    const raw = (value ?? {});
    const point = parseLatLng(raw.lat, raw.lng);
    if (!point)
        throw new http_1.HttpError(400, `${field} needs valid lat and lng`);
    const address = typeof raw.address === 'string' ? raw.address.trim().slice(0, 300) : undefined;
    return { ...point, ...(address ? { address } : {}) };
}
/**
 * The active service area (city / zone) that contains a point. Areas are
 * geofenced as circles; when several overlap the closest center wins.
 */
async function findServiceArea(point) {
    const areas = await areasCache.get('active', () => ServiceArea_1.ServiceArea.find({ status: 'active' }));
    let best = null;
    let bestDistance = Infinity;
    for (const area of areas) {
        const { centerLat, centerLng, radiusKm } = area.geofence ?? {};
        if (centerLat == null || centerLng == null || radiusKm == null)
            continue;
        const distance = haversineKm(point, { lat: centerLat, lng: centerLng });
        if (distance <= radiusKm && distance < bestDistance) {
            best = area;
            bestDistance = distance;
        }
    }
    return best;
}
/** Latitude / longitude limits of the square around a point, for an index-friendly pre-filter before the exact distance check. */
function boundingBox(point, radiusKm) {
    const dLat = radiusKm / 111;
    const dLng = radiusKm / (111 * Math.max(0.1, Math.cos((point.lat * Math.PI) / 180)));
    return { minLat: point.lat - dLat, maxLat: point.lat + dLat, minLng: point.lng - dLng, maxLng: point.lng + dLng };
}
//# sourceMappingURL=geo.js.map