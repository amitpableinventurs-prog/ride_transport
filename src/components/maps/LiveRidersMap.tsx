import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps, onGoogleMapsAuthFailure } from '@/lib/googleMaps'

export interface MapPoint {
  id: string
  lat: number
  lng: number
  color: string
  title: string
  subtitle: string
  status: string
}

interface Props {
  points: MapPoint[]
  /** Called when Google Maps cannot load, so the page can show its fallback view. */
  onUnavailable: (reason: string) => void
}

// India, until the first riders arrive and the map fits to them.
const DEFAULT_VIEW = { center: { lat: 22.5, lng: 79 }, zoom: 5 }

function markerIcon(color: string): google.maps.Symbol {
  return { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 }
}

function infoContent(p: MapPoint) {
  const root = document.createElement('div')
  root.style.cssText = 'font: 12px/1.4 system-ui, sans-serif; color: #1f2f52; min-width: 140px'
  const code = document.createElement('div')
  code.style.fontWeight = '600'
  code.textContent = p.title
  const driver = document.createElement('div')
  driver.textContent = p.subtitle
  const status = document.createElement('div')
  status.style.cssText = `margin-top: 4px; font-weight: 500; color: ${p.color}`
  status.textContent = p.status.replace('_', ' ')
  root.append(code, driver, status)
  return root
}

/** Google Map with one marker per active rider; positions update in place on every poll. */
export function LiveRidersMap({ points, onUnavailable }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  const markersRef = useRef(new Map<string, google.maps.Marker>())
  // Latest data per marker, read when a marker is clicked.
  const pointsRef = useRef(new Map<string, MapPoint>())
  // Fit the view to the riders once; after that the admin's own pan/zoom is kept across polls.
  const fittedRef = useRef(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    const stopAuthWatch = onGoogleMapsAuthFailure(() => onUnavailable('Google Maps rejected the API key. Check the key and its allowed websites.'))
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return
        mapRef.current = new google.maps.Map(containerRef.current, {
          ...DEFAULT_VIEW,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        })
        infoRef.current = new google.maps.InfoWindow()
        setReady(true)
      })
      .catch((err: Error) => !cancelled && onUnavailable(err.message))
    return () => {
      cancelled = true
      stopAuthWatch()
    }
    // The map is created once per page visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const markers = markersRef.current
    const live = new Set(points.map((p) => p.id))
    pointsRef.current = new Map(points.map((p) => [p.id, p]))

    for (const [id, marker] of markers) {
      if (live.has(id)) continue
      marker.setMap(null)
      markers.delete(id)
    }
    for (const p of points) {
      let marker = markers.get(p.id)
      if (!marker) {
        const created = new google.maps.Marker({ map })
        created.addListener('click', () => {
          const latest = pointsRef.current.get(p.id)
          if (!latest) return
          infoRef.current?.setContent(infoContent(latest))
          infoRef.current?.open({ map, anchor: created })
        })
        marker = created
        markers.set(p.id, marker)
      }
      marker.setPosition({ lat: p.lat, lng: p.lng })
      marker.setIcon(markerIcon(p.color))
      marker.setTitle(`${p.title} · ${p.subtitle}`)
    }

    if (!fittedRef.current && points.length) {
      fittedRef.current = true
      if (points.length === 1) {
        map.setCenter({ lat: points[0].lat, lng: points[0].lng })
        map.setZoom(15)
      } else {
        const bounds = new google.maps.LatLngBounds()
        points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }))
        map.fitBounds(bounds, 48)
      }
    }
  }, [points, ready])

  return <div ref={containerRef} className="h-[420px] w-full rounded-xl border border-navy-100 bg-navy-50" />
}
