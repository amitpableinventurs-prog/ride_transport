// Everything on the site that changes per launch lives here. Empty values are hidden on the pages
// (a store button without a link shows "Coming soon"; contact rows without a value are left out).

export const site = {
  name: 'AnZ Cabs',
  tagline: 'Your Ride, Our Priority',

  /** Google Play / App Store pages of the customer app. */
  customerApp: { android: '', ios: '' },
  /** Google Play page of the rider (driver) app. */
  riderApp: { android: '' },

  contact: {
    phone: '+91 70064 74093',
    email: '',
    whatsapp: '',
    address: '52, Afzal Complex, Court Road, Moominabad, Batamaloo, Srinagar, Jammu & Kashmir 190010',
  },

  /** Cities shown under "Where we operate"; keep in line with the service areas in the admin panel. */
  cities: ['Indore', 'Mumbai', 'Pune', 'Bengaluru', 'New Delhi'],

  /** Registered company name, shown on the About and Contact pages. */
  legalName: 'AnZ Cabs & Logistics Private Limited',

  /**
   * Gallery page images. Put the files in `public/gallery/` and list them here; any image format works
   * (photos at about 1200×800 look best). `category` groups them under the filter buttons.
   */
  gallery: [
    { src: '/gallery/bike-ride.svg', alt: 'A rider on a scooter in city traffic', caption: 'Bike rides through city traffic', category: 'Rides' },
    { src: '/gallery/auto-ride.svg', alt: 'A green and yellow auto rickshaw on the road', caption: 'Autos for short city trips', category: 'Rides' },
    { src: '/gallery/cab-economy.svg', alt: 'A blue AnZ cab on a city road', caption: 'Cab Economy for daily commutes', category: 'Rides' },
    { src: '/gallery/cab-night.svg', alt: 'A black sedan driving through the city at night', caption: 'Cab Premium, day or night', category: 'Rides' },
    { src: '/gallery/parcel-delivery.svg', alt: 'A bike porter carrying an AnZ parcel box', caption: 'Bike porters for parcels', category: 'Delivery' },
    { src: '/gallery/goods-truck.svg', alt: 'An AnZ Logistics goods vehicle', caption: 'Goods vehicles for stock and shifting', category: 'Delivery' },
    { src: '/gallery/app-booking.svg', alt: 'A phone showing a booked route on a map', caption: 'Book and track in the app', category: 'App & safety' },
    { src: '/gallery/safety-otp.svg', alt: 'A shield with a tick above a four-digit OTP', caption: 'Every trip starts with your OTP', category: 'App & safety' },
  ],

  /** Policy pages: CMS slug (admin panel → CMS) and the title used in links. */
  policies: [
    { slug: 'terms', title: 'Terms & Conditions' },
    { slug: 'privacy', title: 'Privacy Policy' },
    { slug: 'cancellation', title: 'Cancellation Policy' },
    { slug: 'refund', title: 'Refund Policy' },
    { slug: 'rider_terms', title: 'Rider Terms' },
    { slug: 'partner_terms', title: 'Partner Terms' },
  ],
}

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api/v1').replace(/\/$/, '')
