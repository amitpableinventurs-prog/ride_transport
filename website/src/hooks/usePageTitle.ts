import { useEffect } from 'react'

const DEFAULT_TITLE = 'AnZ Cabs – Bike, Auto, Cab & Parcel Delivery | Your Ride, Our Priority'

/** Sets the browser tab title for the page; no title gives the home page title. */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | AnZ Cabs` : DEFAULT_TITLE
  }, [title])
}
