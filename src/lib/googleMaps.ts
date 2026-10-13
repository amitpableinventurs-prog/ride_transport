// Loads the Google Maps JavaScript API once per page (key from VITE_GOOGLE_MAPS_API_KEY).

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''
const CALLBACK = '__anzGoogleMapsReady'

let loading: Promise<void> | null = null

export const googleMapsConfigured = Boolean(apiKey)

declare global {
  interface Window {
    __anzGoogleMapsReady?: () => void
    /** Called by Google when the key is rejected (wrong key, API not enabled, domain not allowed). */
    gm_authFailure?: () => void
  }
}

export function loadGoogleMaps(): Promise<void> {
  if (!apiKey) return Promise.reject(new Error('Google Maps key is not configured (VITE_GOOGLE_MAPS_API_KEY).'))
  loading ??= new Promise<void>((resolve, reject) => {
    window[CALLBACK] = () => {
      Promise.all([google.maps.importLibrary('maps'), google.maps.importLibrary('marker')]).then(() => resolve(), reject)
    }
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${CALLBACK}`
    script.async = true
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error('Could not load Google Maps. Check the internet connection.'))
    }
    document.head.appendChild(script)
  })
  return loading
}

/** Runs `onFailure` when Google rejects the key after the script has loaded. */
export function onGoogleMapsAuthFailure(onFailure: () => void) {
  window.gm_authFailure = onFailure
  return () => {
    if (window.gm_authFailure === onFailure) window.gm_authFailure = undefined
  }
}
