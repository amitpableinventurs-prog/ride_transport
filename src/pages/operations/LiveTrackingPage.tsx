import { useCallback, useEffect, useState } from 'react'
import { fetchBookings } from '@/api/bookings'
import type { Booking } from '@/types/booking'
import { Badge } from '@/components/common/Badge'
import { LoadingScreen } from '@/components/common/LoadingScreen'

const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
const LIVE_STATUSES = 'accepted,arriving,started,in_transit'

const STATUS_COLOR: Record<string, string> = {
  accepted: '#7e93ba',
  arriving: '#1f2f52',
  started: '#f5820c',
  in_transit: '#d96e04',
}

type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

function statusTone(status: string): BadgeTone {
  if (status === 'started' || status === 'in_transit') return 'warning'
  if (status === 'arriving') return 'info'
  return 'neutral'
}

interface Point {
  bookingId: string
  bookingCode: string
  driverName: string
  status: string
  lat: number
  lng: number
  updatedAt?: string
}

function buildPoints(bookings: Booking[]): Point[] {
  const points: Point[] = []
  for (const b of bookings) {
    const driver = b.driver && typeof b.driver === 'object' ? b.driver : null
    const lat = driver?.currentLocation?.lat ?? b.pickup?.lat
    const lng = driver?.currentLocation?.lng ?? b.pickup?.lng
    if (lat == null || lng == null) continue
    points.push({
      bookingId: b.id,
      bookingCode: b.bookingCode,
      driverName: driver?.name ?? 'Unassigned',
      status: b.status,
      lat,
      lng,
      updatedAt: driver?.currentLocation?.updatedAt,
    })
  }
  return points
}

export function LiveTrackingPage() {
  const [bookings, setBookings] = useState<Booking[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activePoint, setActivePoint] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchBookings({ status: LIVE_STATUSES, limit: 100 })
      .then((data) => setBookings(data.items))
      .catch(() => setError('Could not load live tracking data.'))
  }, [])

  useEffect(() => {
    load()
    // Polling on a fixed interval stands in for a real-time feed (e.g. WebSocket / SSE),
    // which is out of scope for this admin panel slice — see the on-page note as well.
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [load])

  if (!bookings) return <LoadingScreen />

  const points = buildPoints(bookings)
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const minLat = points.length ? Math.min(...lats) : 0
  const maxLat = points.length ? Math.max(...lats) : 0
  const minLng = points.length ? Math.min(...lngs) : 0
  const maxLng = points.length ? Math.max(...lngs) : 0
  const latSpan = maxLat - minLat || 1
  const lngSpan = maxLng - minLng || 1

  function positionFor(p: Point) {
    const left = points.length > 1 ? ((p.lng - minLng) / lngSpan) * 100 : 50
    // Screen Y grows downward while latitude grows upward, so invert.
    const top = points.length > 1 ? (1 - (p.lat - minLat) / latSpan) * 100 : 50
    return { left: `${Math.min(96, Math.max(4, left))}%`, top: `${Math.min(96, Math.max(4, top))}%` }
  }

  const activePointData = points.find((p) => p.bookingId === activePoint) ?? null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-navy-800">Live Tracking</h1>
        <p className="text-sm text-navy-400">Approximate positions of drivers currently on an active booking.</p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-brand-red">{error}</p>}

      <div className="rounded-2xl border border-navy-100 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs text-navy-400">
          Simplified visualization — swap in Google Maps or another map SDK for real geo-rendering.
        </p>
        <div className="relative mx-auto h-[400px] w-full max-w-[600px] overflow-hidden rounded-xl border border-navy-100 bg-navy-50">
          <p className="absolute left-2 top-2 text-[10px] font-medium uppercase tracking-wide text-navy-300">
            Live positions (simplified view)
          </p>
          {points.length === 0 && (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-navy-300">
              No active bookings with location data.
            </p>
          )}
          {points.map((p) => (
            <button
              key={p.bookingId}
              type="button"
              onClick={() => setActivePoint((prev) => (prev === p.bookingId ? null : p.bookingId))}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
              style={{ ...positionFor(p), backgroundColor: STATUS_COLOR[p.status] ?? '#1f2f52' }}
              title={`${p.bookingCode} · ${p.driverName}`}
              aria-label={`${p.bookingCode} — ${p.driverName}`}
            />
          ))}
          {activePointData && (
            <div
              className="absolute z-10 w-48 rounded-lg border border-navy-100 bg-white p-2.5 text-xs shadow-lg"
              style={{ ...positionFor(activePointData), transform: 'translate(-50%, -110%)' }}
            >
              <p className="font-semibold text-navy-800">{activePointData.bookingCode}</p>
              <p className="text-navy-500">{activePointData.driverName}</p>
              <Badge tone={statusTone(activePointData.status)}>{activePointData.status}</Badge>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/50 text-xs uppercase tracking-wide text-navy-400">
              <th className="px-5 py-3 font-medium">Booking</th>
              <th className="px-5 py-3 font-medium">Driver</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Last location update</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.bookingId} className="border-b border-navy-50 last:border-0">
                <td className="px-5 py-3 font-medium text-navy-800">{p.bookingCode}</td>
                <td className="px-5 py-3 text-navy-600">{p.driverName}</td>
                <td className="px-5 py-3">
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                </td>
                <td className="px-5 py-3 text-navy-500">{p.updatedAt ? dateFmt.format(new Date(p.updatedAt)) : '—'}</td>
              </tr>
            ))}
            {points.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-navy-300">
                  No active bookings with location data.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
