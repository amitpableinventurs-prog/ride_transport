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
