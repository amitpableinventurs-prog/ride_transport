// OpenAPI 3.0 spec for the Admin API, served by Swagger UI at /api-docs.
// Keep this in sync with src/routes/* when adding or changing endpoints.
import { env } from '../config/env'
import { PERMISSION_KEYS, ROLE_KEYS } from '../types/rbac'
import { GENDERS } from '../models/personalProfile'

type Schema = Record<string, unknown>

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const json = (schema: Schema) => ({ content: { 'application/json': { schema } } })
const str = (extra: Schema = {}) => ({ type: 'string', ...extra })
const num = (extra: Schema = {}) => ({ type: 'number', ...extra })
const int = (extra: Schema = {}) => ({ type: 'integer', ...extra })
const bool = (extra: Schema = {}) => ({ type: 'boolean', ...extra })
const date = (extra: Schema = {}) => ({ type: 'string', format: 'date-time', ...extra })
const oid = (description?: string) => ({ type: 'string', example: '665f1c2e9b1e8a0012345678', ...(description ? { description } : {}) })
const enumOf = (values: readonly string[], extra: Schema = {}) => ({ type: 'string', enum: values, ...extra })
const arr = (items: Schema) => ({ type: 'array', items })
const obj = (properties: Record<string, Schema>, required?: string[]) => ({
  type: 'object',
  properties,
  ...(required?.length ? { required } : {}),
})
const anyObj = { type: 'object', additionalProperties: true }

const pathParam = (name: string, description: string, schema: Schema = str()) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema,
})
const query = (name: string, description: string, schema: Schema = str()) => ({ name, in: 'query', required: false, description, schema })

const idParam = { $ref: '#/components/parameters/Id' }
const pageParams = [{ $ref: '#/components/parameters/Page' }, { $ref: '#/components/parameters/Limit' }]
const qParam = (fields: string) => query('q', `Case-insensitive search on ${fields}`)

const ACTIVE_INACTIVE = ['active', 'inactive'] as const
const ACCOUNT_STATUS = ['active', 'suspended', 'blocked'] as const
const APPROVAL_STATUS = ['pending', 'verified', 'rejected'] as const
const DOC_STATUS = ['pending', 'verified', 'rejected', 'expired'] as const
const SERVICE_MODE = ['ride', 'transport'] as const
const SERVICE_MODE_BOTH = ['ride', 'transport', 'both'] as const
const BOOKING_STATUS = ['scheduled', 'requested', 'no_rider_found', 'accepted', 'arriving', 'arrived', 'started', 'in_transit', 'completed', 'cancelled'] as const
const CMS_SLUGS = ['about', 'contact', 'terms', 'privacy', 'cancellation', 'refund', 'rider_terms', 'partner_terms', 'faq'] as const
const WALLET_REASONS = ['booking_earning', 'booking_payment', 'tip', 'commission', 'recharge', 'refund', 'penalty', 'bonus', 'withdrawal', 'adjustment'] as const

interface OpOptions {
  permission?: string
  description?: string
  parameters?: unknown[]
  body?: Schema
  bodyRequired?: boolean
  response?: Schema
  status?: 200 | 201 | 204
  errors?: number[]
  auth?: boolean
  /** Mobile-app endpoint: secured with the app token instead of the admin token. */
  app?: boolean
}

function op(tag: string, summary: string, opts: OpOptions = {}) {
  const auth = opts.auth ?? true
  const status = opts.status ?? 200
  const descriptionParts = [opts.description, opts.permission ? `**Permission:** \`${opts.permission}\`` : undefined].filter(Boolean)

  const responses: Record<string, unknown> = {
    [status]: status === 204 ? { description: 'No content' } : { description: 'Success', ...json(opts.response ?? anyObj) },
  }
  for (const code of opts.errors ?? []) responses[code] = { $ref: `#/components/responses/E${code}` }
  if (auth) {
    responses[401] = { $ref: '#/components/responses/E401' }
    if (opts.permission) responses[403] = { $ref: '#/components/responses/E403' }
  }

  return {
    tags: [tag],
    summary,
    ...(descriptionParts.length ? { description: descriptionParts.join('\n\n') } : {}),
    ...(!auth ? { security: [] } : opts.app ? { security: [{ appBearerAuth: [] }] } : {}),
    ...(opts.parameters?.length ? { parameters: opts.parameters } : {}),
    ...(opts.body ? { requestBody: { required: opts.bodyRequired ?? true, ...json(opts.body) } } : {}),
    responses,
  }
}

const listOf = (name: string) => arr(ref(name))
const paginated = (name: string) => ({
  allOf: [ref('Paginated'), obj({ items: listOf(name) })],
})
const paginatedPageSize = (name: string) => ({
  allOf: [ref('PaginatedPageSize'), obj({ items: listOf(name) })],
})

// Response entities are documented loosely: Mongoose documents with timestamps.
// Only schemas using idToJson (Admin, Customer, Driver) serialize `id`; the rest keep `_id`.
const entity = (properties: Record<string, Schema>, idKey: 'id' | '_id' = '_id') => ({
  type: 'object',
  properties: { [idKey]: oid(), ...properties, createdAt: date(), updatedAt: date() },
})

const reportRange = [
  query('from', 'Start date (ISO). Defaults to 30 days ago.', str({ format: 'date', example: '2026-09-01' })),
  query('to', 'End date (ISO). A date-only value includes the whole day. Defaults to now.', str({ format: 'date', example: '2026-09-24' })),
]

const prefixPaths = (prefix: string, paths: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(paths).map(([path, item]) => [`${prefix}${path}`, item]))

const appPhoneBody = {
  phone: str({ example: '9876543210', description: '10-digit Indian mobile; +91 / 0 prefixes and spaces are accepted' }),
  userType: enumOf(['customer', 'driver', 'partner']),
}

// Mobile-app APIs (Flutter customer / rider-driver / partner apps), mounted at /api/v1/app.
const appPaths = {
  '/auth/otp/send': {
    post: op('App Auth', 'Send a login OTP by SMS', {
      auth: false,
      description: [
        'Step 1 of phone login and sign-up. Works for new and existing numbers.',
        'Resend cooldown `OTP_RESEND_COOLDOWN_SECONDS` (default 30s); at most `OTP_MAX_SENDS_PER_HOUR` (default 5) sends per number per hour.',
        'Blocked/suspended accounts get `403`. All app APIs return `503` while Settings → Maintenance mode is on.',
      ].join('\n\n'),
      body: obj(appPhoneBody, ['phone', 'userType']),
      response: ref('AppOtpSent'),
      errors: [400, 403, 429],
    }),
  },
  '/auth/otp/resend': {
    post: op('App Auth', 'Resend the login OTP', {
      auth: false,
      description: 'Same as `/auth/otp/send`: issues a fresh code and invalidates the previous one.',
      body: obj(appPhoneBody, ['phone', 'userType']),
      response: ref('AppOtpSent'),
      errors: [400, 403, 429],
    }),
  },
  '/auth/otp/verify': {
    post: op('App Auth', 'Verify the OTP and log in', {
      auth: false,
      description: [
        'Existing user: `isNewUser: false` with tokens.',
        'New number: `isNewUser: true` with a `registrationToken` (valid 30 min) for `/auth/register`.',
        'Wrong codes return `attemptsLeft`; after 5 wrong attempts a new OTP must be requested.',
      ].join('\n\n'),
      body: obj({ ...appPhoneBody, otp: str({ example: '123456', pattern: '^\\d{6}$' }) }, ['phone', 'userType', 'otp']),
      response: { oneOf: [ref('AppAuthExistingUser'), ref('AppAuthNewUser')] },
      errors: [400, 403, 429],
    }),
  },
  '/auth/register': {
    post: op('App Auth', 'Complete sign-up for a new phone number', {
      auth: false,
      description: [
        'Required fields depend on the `userType` the OTP was verified for:',
        '',
        'This is the app **Profile** screen for customers and riders/drivers.',
        '',
        '- **customer**: `name`, `emergencyContact` (optional `email`, `gender`, `dateOfBirth`, `city`)',
        '- **driver**: `name`, `emergencyContact`, `serviceType` (`rider` or `transport`) (optional `email`, `gender`, `dateOfBirth`; must be 18+ if given). Starts as `approvalStatus: pending` until an admin verifies documents.',
        '- **partner**: `companyName`, `ownerName` (optional `email`, `businessRegNo`, `taxId`). Starts as `pending`.',
      ].join('\n'),
      body: ref('AppRegisterRequest'),
      response: ref('AppAuthTokens'),
      status: 201,
      errors: [400, 409],
    }),
  },
  '/auth/refresh': {
    post: op('App Auth', 'Exchange an app refresh token for a new token pair', {
      auth: false,
      body: ref('RefreshRequest'),
      response: ref('TokenPair'),
      errors: [401],
    }),
  },
  '/auth/me': {
    get: op('App Auth', 'Profile of the logged-in app user', { app: true, response: ref('AppUser') }),
  },
  '/auth/logout': {
    post: op('App Auth', 'Log out (the app discards its tokens)', { app: true, status: 204 }),
  },
  '/profile': {
    get: op('App Profile', 'Get the Profile screen data', {
      app: true,
      description: 'Same record as `/auth/me`. `profileComplete: false` means the app should show the Profile screen (name or emergency contact missing).',
      response: ref('AppUser'),
    }),
    patch: op('App Profile', 'Update the profile', {
      app: true,
      description: [
        'Send only the fields that changed. Customers and riders/drivers: `name`, `email`, `gender`, `dateOfBirth`, `emergencyContact` (plus `city` for customers).',
        'Send `null` or `""` for `email`, `gender` or `dateOfBirth` to clear them. The emergency contact can be replaced but not removed.',
        'The phone number is the OTP-verified login and cannot be changed here; sending the same number back is allowed.',
        'Partners: `companyName`, `ownerName`, `email`, `businessRegNo`, `taxId`.',
      ].join('\n\n'),
      body: ref('AppProfileUpdate'),
      bodyRequired: false,
      response: ref('AppUser'),
      errors: [400, 409],
    }),
  },
}

// ---------------- Customer + rider apps (SRS §10.1-10.5) ----------------

const place = obj({ lat: num({ example: 19.076 }), lng: num({ example: 72.8777 }), address: str({ example: 'Dadar, Mumbai' }) }, ['lat', 'lng'])
const dropStop = obj(
  {
    lat: num({ example: 19.1 }),
    lng: num({ example: 72.89 }),
    address: str({ example: 'Kurla, Mumbai' }),
    contactName: str({ description: 'Transport: receiver name' }),
    contactPhone: str({ description: 'Transport: receiver mobile' }),
  },
  ['lat', 'lng'],
)
const tripBody = {
  pickup: place,
  drops: arr(dropStop),
  drop: { ...place, description: 'Shorthand for a single drop (rides)' },
  goods: obj({ description: str({ example: 'Documents' }), weightKg: num(), notes: str(), needsLoading: bool() }),
}
const gatewayOrder = obj({
  orderId: str({ example: 'order_mock_1a2b3c' }),
  amount: num(),
  currency: str({ example: 'INR' }),
  purpose: enumOf(['booking', 'wallet_topup', 'rider_dues']),
  provider: enumOf(['mock', 'razorpay']),
  key: str({ description: 'Razorpay key id for the checkout SDK' }),
})
const verifyBody = obj(
  {
    orderId: str(),
    paymentId: str({ example: 'pay_29QQoUBi66xm2f' }),
    signature: str({ description: 'Gateway signature. With PAYMENT_PROVIDER=mock (development) send `mock_success`.' }),
  },
  ['orderId', 'paymentId', 'signature'],
)
const bookingIdParam = pathParam('id', 'Booking id', oid())
const binary = (description: string) => str({ format: 'binary', description })
/** Same operation, but with a multipart/form-data body (file uploads). */
const multipart = (operation: ReturnType<typeof op>, fields: Record<string, Schema>, required: string[]) => ({
  ...operation,
  requestBody: { required: required.length > 0, content: { 'multipart/form-data': { schema: obj(fields, required) } } },
})
const appOp = (tag: string, summary: string, opts: OpOptions = {}) => op(tag, summary, { app: true, ...opts })
const TICKET_CATEGORIES = ['payment', 'booking', 'driver', 'vehicle', 'lost_item', 'refund', 'cancellation', 'technical'] as const
const APP_LANGUAGES = ['en', 'hi', 'mr', 'gu', 'bn', 'ta', 'te', 'kn', 'ml', 'pa', 'or'] as const
const RIDER_DOC_TYPES = ['driving_license', 'vehicle_rc', 'vehicle_insurance', 'aadhaar', 'pan', 'pollution_certificate', 'permit', 'police_verification'] as const

// SOS, tickets and notifications are the same in both apps.
const supportPaths = (tag: string) => ({
  '/sos': {
    post: appOp(tag, 'Raise SOS', {
      description: 'Alerts admins live (`sos:alert` on the /admin socket) and SMSes the emergency contacts a map link.',
      body: obj({ lat: num(), lng: num(), bookingId: oid('Optional; must be your booking'), note: str() }, ['lat', 'lng']),
      status: 201,
      errors: [400, 404],
    }),
  },
  '/tickets': {
    get: appOp(tag, 'My support tickets', { parameters: pageParams }),
    post: appOp(tag, 'Raise a support ticket', {
      body: obj({ subject: str(), category: enumOf(TICKET_CATEGORIES), description: str(), bookingId: oid() }, ['subject', 'category']),
      status: 201,
      errors: [400, 404],
    }),
  },
  '/notifications': {
    get: appOp(tag, 'Notification inbox', {
      description: 'Personal notifications (marked read when returned) plus `announcements`: admin push broadcasts from the last 30 days.',
      parameters: pageParams,
    }),
  },
})

// Response shapes for the Home / Services / Referral / onboarding screens.
const placeItem = obj(
  { name: str({ example: 'Vijay Nagar' }), address: str({ example: 'Vijay Nagar, Indore' }), lat: num({ example: 22.7533 }), lng: num({ example: 75.8937 }), favouriteId: { type: 'string', nullable: true, description: 'Saved-place id when favourited (filled heart), else null' } },
  ['name', 'address', 'lat', 'lng', 'favouriteId'],
)
const serviceItem = obj(
  {
    key: str({ example: 'auto' }),
    name: str({ example: 'Auto' }),
    description: { type: 'string', nullable: true, example: 'Budget-friendly 3-seater' },
    icon: str({ example: 'car-taxi-front', description: 'Icon name set in the admin panel; the app maps it to its own artwork' }),
    seats: { type: 'integer', nullable: true, example: 3 },
    capacityLabel: { type: 'string', nullable: true, example: null },
    available: bool({ description: 'false when the mode is off or the location is outside every service area' }),
    ridersNearby: { type: 'integer', nullable: true, example: 2, description: 'null when lat/lng were not sent' },
    etaMin: { type: 'integer', nullable: true, example: 4, description: 'Nearest rider ETA in minutes; null when none or no location' },
  },
  ['key', 'name', 'icon', 'available'],
)
const allServicesResponse = {
  ...obj(
    {
      serviceable: { type: 'boolean', nullable: true, description: 'null when lat/lng were not sent' },
      serviceArea: { type: 'object', nullable: true, properties: { id: oid(), name: str(), city: str() } },
      message: { type: 'string', nullable: true },
      sections: arr(
        obj(
          {
            mode: enumOf(['ride', 'transport']),
            title: str({ example: 'Ride' }),
            subtitle: str({ example: 'City trips for people. Pick an auto, bike or cab.' }),
            enabled: bool(),
            items: arr(serviceItem),
          },
          ['mode', 'title', 'subtitle', 'enabled', 'items'],
        ),
      ),
    },
    ['serviceable', 'sections'],
  ),
  example: {
    serviceable: true,
    serviceArea: { id: '6aab82095020de04ab68e9c6', name: 'Mumbai Metro', city: 'Mumbai' },
    message: null,
    sections: [
      {
        mode: 'ride',
        title: 'Ride',
        subtitle: 'City trips for people. Pick an auto, bike or cab.',
        enabled: true,
        items: [
          { key: 'auto', name: 'Auto', description: 'Budget-friendly 3-seater', icon: 'car-taxi-front', seats: 3, capacityLabel: null, available: true, ridersNearby: 2, etaMin: 4 },
          { key: 'bike_lite', name: 'Bike Lite', description: 'Low-cost solo rides', icon: 'bike', seats: 1, capacityLabel: null, available: true, ridersNearby: 0, etaMin: null },
        ],
      },
      {
        mode: 'transport',
        title: 'Transport',
        subtitle: 'Send goods across the city, from a bike parcel to a large truck.',
        enabled: true,
        items: [{ key: 'bike_porter', name: 'Bike Porter', description: 'Parcels, fastest delivery', icon: 'package', seats: null, capacityLabel: 'Parcels', available: true, ridersNearby: 1, etaMin: 6 }],
      },
    ],
  },
}
const homeResponse = obj({
  name: str({ example: 'Nikhil Sajjan' }),
  firstName: str({ example: 'Nikhil' }),
  initial: str({ example: 'N' }),
  serviceable: { type: 'boolean', nullable: true },
  city: { type: 'string', nullable: true, example: 'Indore' },
  modes: obj({ ride: bool(), transport: bool() }),
  activeBooking: { type: 'object', nullable: true, properties: { id: oid(), bookingCode: str({ example: 'BK-1042' }), status: str({ example: 'accepted' }), mode: enumOf(['ride', 'transport']), categoryKey: str(), drop: anyObj } },
  savedPlaces: arr(obj({ id: oid(), label: enumOf(['home', 'work', 'other']), name: str(), address: str(), lat: num(), lng: num() })),
  recentPlaces: arr(placeItem),
})
const reverseResponse = obj({ lat: num(), lng: num(), address: { type: 'string', nullable: true, example: 'Palasia, Indore' }, city: { type: 'string', nullable: true, example: 'Indore' }, serviceable: bool() })
const referralResponse = {
  ...obj({
    enabled: bool(),
    code: str({ example: 'RIDE6655' }),
    title: str({ example: 'Invite friends to AnZ Cabs' }),
    description: str(),
    shareMessage: str({ example: 'Join AnZ Cabs and get ₹50 ride credit on your first ride. Use my code RIDE6655 when you sign up.' }),
    rewardForYou: num({ example: 50 }),
    rewardForFriend: num({ example: 50 }),
    currency: str({ example: 'INR' }),
    steps: arr(obj({ step: int(), title: str(), description: str() })),
    stats: obj({ invited: int(), rewarded: int(), totalEarned: num() }),
    referrals: arr(obj({ name: str(), joinedAt: date(), status: enumOf(['pending', 'rewarded']) })),
    appliedCode: bool({ description: 'true when this customer already used a referral code' }),
  }),
  example: {
    enabled: true,
    code: 'RIDE6655',
    title: 'Invite friends to AnZ Cabs',
    description: 'When a friend completes their first ride, you both get ride credit.',
    shareMessage: 'Join AnZ Cabs and get ₹50 ride credit on your first ride. Use my code RIDE6655 when you sign up.',
    rewardForYou: 50,
    rewardForFriend: 50,
    currency: 'INR',
    steps: [{ step: 1, title: 'Share your code', description: 'Send it to friends who are new to AnZ Cabs.' }],
    stats: { invited: 3, rewarded: 1, totalEarned: 50 },
    referrals: [{ name: 'Asha', joinedAt: '2026-10-01T10:00:00Z', status: 'rewarded' }],
    appliedCode: false,
  },
}
const onboardingStatusResponse = {
  ...obj({
    status: enumOf(['pending', 'under_review', 'approved', 'rejected']),
    title: str({ example: 'Documents under verification' }),
    message: { type: 'string', nullable: true, example: 'This may take up to 24 hours. Please wait!' },
    items: arr(obj({ key: enumOf(['vehicle', 'driving_license', 'photo_name', 'vehicle_number', 'identity']), title: str({ example: 'Driving License' }), status: enumOf(['not_submitted', 'selected', 'under_review', 'verified', 'rejected']), reason: str() })),
    nextStep: { type: 'string', nullable: true, description: 'First item still to submit or fix' },
    hasLicense: { type: 'boolean', nullable: true },
  }),
  example: {
    status: 'under_review',
    title: 'Documents under verification',
    message: 'This may take up to 24 hours. Please wait!',
    items: [
      { key: 'vehicle', title: 'Vehicle - Bike', status: 'selected' },
      { key: 'driving_license', title: 'Driving License', status: 'verified' },
      { key: 'photo_name', title: 'Photo and name', status: 'verified' },
      { key: 'vehicle_number', title: 'Vehicle Number', status: 'under_review' },
      { key: 'identity', title: 'Aadhaar or PAN card', status: 'under_review' },
    ],
    nextStep: null,
    hasLicense: true,
  },
}

const customerPaths = {
  '/profile': {
    get: appOp('Customer', 'Get profile', { response: ref('AppUser') }),
    patch: multipart(
      appOp('Customer', 'Update name, email, photo, language', {
        description: 'JSON or multipart. Fields: `name`, `email`, `gender`, `dateOfBirth`, `emergencyContact`, `city`, plus `language` and `photoUrl`; upload a new photo as multipart `photo`.',
        response: ref('AppUser'),
        errors: [400],
      }),
      { name: str(), email: str(), language: enumOf(APP_LANGUAGES), photo: binary('JPEG/PNG/WebP up to 5 MB'), emergencyContact: str({ description: 'JSON string in multipart' }) },
      [],
    ),
  },
  '/home': {
    get: appOp('Customer', 'Home screen summary', {
      response: homeResponse,
      description:
        'Name and initial for the greeting, serviceability and enabled modes at `lat`/`lng` (both optional), any open booking, saved places and the latest recent places.',
      parameters: [query('lat', 'Latitude', num()), query('lng', 'Longitude', num())],
    }),
  },
  '/all-services': {
    get: appOp('Customer', 'All Services screen in one call', {
      response: allServicesResponse,
      description:
        'Two sections (Ride, Transport), each with `title`, `subtitle` and `items` (key, name, icon, seats or capacityLabel). `lat`/`lng` are optional: without them every active category is listed; with them `serviceable`, the `available` flag, `ridersNearby` and `etaMin` are filled. Categories are managed in the admin panel (Operations → Categories).',
      parameters: [query('lat', 'Latitude', num()), query('lng', 'Longitude', num())],
    }),
  },
  '/recent-places': {
    get: appOp('Customer', 'Recent destinations', {
      response: arr(placeItem),
      description: 'Distinct drop-offs from past bookings, newest first. `favouriteId` is set when the place is saved (filled heart): tap to un-favourite with `DELETE /saved-places/{id}`, otherwise favourite it with `POST /saved-places` (label `other`).',
      parameters: [query('limit', 'Default 6, max 20', int())],
    }),
  },
  '/places/search': {
    get: appOp('Customer', 'Search saved and recent places', {
      response: arr(obj({ ...placeItem.properties, distanceKm: { type: 'number', nullable: true } })),
      description: 'Pickup/drop search box. Matches the customer\'s own places only; use the map SDK for city-wide search.',
      parameters: [query('q', 'Text to match in name or address (required)'), query('lat', 'Latitude for `distanceKm`', num()), query('lng', 'Longitude for `distanceKm`', num())],
      errors: [400],
    }),
  },
  '/places/reverse': {
    get: appOp('Customer', 'Address under the pickup pin', {
      response: reverseResponse,
      description: 'Known address within 200 m (saved or recent), else `address: null` with the service-area `city`. A geocoding provider is not wired in yet.',
      parameters: [query('lat', 'Latitude', num()), query('lng', 'Longitude', num())],
      errors: [400],
    }),
  },
  '/referral': {
    get: appOp('Customer', 'Refer & Earn screen', {
      response: referralResponse,
      description: 'Own referral code (created on first call), share text, reward amounts, how-it-works steps, stats and the list of invited friends.',
    }),
  },
  '/referral/apply': {
    post: appOp('Customer', 'Apply a friend\'s referral code', {
      response: obj({ message: str(), rewardForYou: num({ example: 50 }) }),
      description: 'Once per customer, before their first completed ride. When that ride completes, both wallets get a `referral` credit (amounts in platform settings).',
      body: obj({ code: str({ example: 'RIDE6655' }) }, ['code']),
      errors: [400, 404, 409, 422],
    }),
  },
  '/saved-places': {
    get: appOp('Customer', 'Saved places'),
    post: appOp('Customer', 'Add a saved place', {
      description: '`home` and `work` are unique: saving one replaces the previous. `other` needs a `name`. Up to 10 places.',
      body: obj({ label: enumOf(['home', 'work', 'other']), name: str({ example: 'Gym' }), address: str(), lat: num(), lng: num() }, ['label', 'address', 'lat', 'lng']),
      status: 201,
      errors: [400],
    }),
  },
  '/saved-places/{id}': { delete: appOp('Customer', 'Delete a saved place', { parameters: [idParam], status: 204, errors: [404] }) },
  '/emergency-contacts': {
    get: appOp('Customer', 'SOS contacts'),
    put: appOp('Customer', 'Replace SOS contacts (1-3)', {
      description: 'The first contact is also the Profile screen emergency contact.',
      body: obj({ contacts: arr(obj({ name: str(), phone: str() }, ['name', 'phone'])) }, ['contacts']),
      errors: [400],
    }),
  },
  '/services': {
    get: appOp('Customer', 'Ride + Transport categories at a location', {
      description: 'Per category: `ridersNearby` and `etaMin` of the nearest online rider. `serviceable: false` outside every service area.',
      parameters: [query('lat', 'Latitude', num()), query('lng', 'Longitude', num())],
      errors: [400],
    }),
  },
  '/fare-estimate': {
    post: appOp('Customer', 'Fare per category for pickup, drops and goods', {
      description:
        'Rides have one drop; transport up to 5. Optional `mode`, `categoryKey`, `couponCode`, `scheduledAt`. Distance is estimated (straight line × 1.3) until a maps provider is added.',
      body: obj({ ...tripBody, mode: enumOf(SERVICE_MODE), categoryKey: str(), couponCode: str(), scheduledAt: date() }, ['pickup']),
      errors: [400, 422],
    }),
  },
  '/coupons/validate': {
    post: appOp('Customer', 'Check a coupon against an estimate', {
      description: 'Always `200`; `valid: false` carries the reason.',
      body: obj({ code: str({ example: 'WELCOME50' }), categoryKey: str(), fareTotal: num(), pickup: place }, ['code', 'categoryKey', 'fareTotal']),
    }),
  },
  '/bookings': {
    post: appOp('Customer', 'Create a Ride or Transport booking (now or scheduled)', {
      description: [
        'Needs a complete profile. Starts matching immediately (status `requested`) unless `scheduledAt` (30 min to 7 days ahead) is set.',
        'The response has `startOtp` (and a per-stop `otp` for transport) for the customer to share; riders never see them.',
        '`409` if another booking is ongoing. `402` for wallet payment without enough balance.',
      ].join('\n\n'),
      body: obj(
        { ...tripBody, categoryKey: str({ example: 'bike' }), mode: enumOf(SERVICE_MODE), paymentMethod: enumOf(['cash', 'wallet', 'upi', 'card', 'netbanking']), couponCode: str(), scheduledAt: date() },
        ['categoryKey', 'pickup'],
      ),
      status: 201,
      errors: [400, 402, 403, 409, 422],
    }),
    get: appOp('Customer', 'Booking history', {
      parameters: [...pageParams, query('mode', 'ride or transport', enumOf(SERVICE_MODE)), query('status', 'Comma-separated statuses', str({ example: 'completed,cancelled' })), ...reportRange],
    }),
  },
  '/bookings/{id}': { get: appOp('Customer', 'Booking detail: rider, timeline, fare', { parameters: [bookingIdParam], errors: [404] }) },
  '/bookings/{id}/track': { get: appOp('Customer', 'Rider live location + ETA (fallback to socket)', { parameters: [bookingIdParam], errors: [404] }) },
  '/bookings/{id}/drop': {
    patch: appOp('Customer', 'Change the drop during the trip', {
      description: 'Re-prices the trip and emits `booking:fare_updated` to customer and rider.',
      parameters: [bookingIdParam],
      body: obj({ drop: place }, ['drop']),
      errors: [400, 404, 409, 422],
    }),
  },
  '/bookings/{id}/cancel': {
    post: appOp('Customer', 'Cancel with reason; returns the charge applied', {
      description:
        'Free while searching and for `freeCancellationMinutes` (default 2) after a rider accepts. After that, or once the rider has arrived, the category cancellation fee is charged to the wallet and paid to the rider.',
      parameters: [bookingIdParam],
      body: obj({ reason: str() }),
      bodyRequired: false,
      errors: [404, 409],
    }),
  },
  '/bookings/{id}/retry': { post: appOp('Customer', 'Retry the search after "no rider found"', { parameters: [bookingIdParam], errors: [404, 409] }) },
  '/bookings/{id}/rating': {
    post: appOp('Customer', 'Rate the rider and tip', {
      description: 'The tip (₹1-500) is paid from the wallet to the rider.',
      parameters: [bookingIdParam],
      body: obj({ score: int({ minimum: 1, maximum: 5 }), comment: str(), tip: num() }, ['score']),
      status: 201,
      errors: [400, 402, 404, 409],
    }),
  },
  '/bookings/{id}/invoice': { get: appOp('Customer', 'Invoice PDF link (valid 7 days)', { parameters: [bookingIdParam], errors: [404, 409] }) },
  '/bookings/{id}/share': { post: appOp('Customer', 'Create a public tracking link', { parameters: [bookingIdParam], errors: [404, 409] }) },
  '/bookings/{id}/call': {
    post: appOp('Customer', 'Number to call the rider', {
      description:
        'Masked calling is not integrated yet: with TELEPHONY_PROVIDER=direct (development) this returns the real number with `masked: false`; production returns `503` until a provider is added.',
      parameters: [bookingIdParam],
      errors: [404, 409, 503],
    }),
  },
  '/wallet': { get: appOp('Customer', 'Balance + transactions', { parameters: pageParams }) },
  '/wallet/topup': {
    post: appOp('Customer', 'Gateway order to add money (₹10-10,000)', { body: obj({ amount: num({ example: 500 }) }, ['amount']), response: gatewayOrder, status: 201, errors: [400, 503] }),
  },
  '/payments/order': {
    post: appOp('Customer', 'Gateway order for a completed, unpaid booking', { body: obj({ bookingId: oid() }, ['bookingId']), response: gatewayOrder, status: 201, errors: [404, 409, 503] }),
  },
  '/payments/verify': {
    post: appOp('Customer', 'Verify the gateway signature after payment', { description: 'Applies the payment once (booking marked paid, or wallet credited).', body: verifyBody, errors: [400, 404] }),
  },
  '/offers': { get: appOp('Customer', 'Active coupons and banners') },
  ...supportPaths('Customer'),
  '/account': {
    delete: appOp('Customer', 'Request account deletion', { body: obj({ reason: str() }), bodyRequired: false, errors: [409] }),
  },
}

const riderPaths = {
  '/auth/otp/send': {
    post: op('Rider', 'Rider login: send OTP', {
      auth: false,
      description: 'Rider-only login. The account type is always a rider, so only the phone is sent (no `role`).',
      body: obj({ phone: str({ example: '9876543210' }) }, ['phone']),
      response: ref('AppOtpSent'),
      errors: [400, 403, 429],
    }),
  },
  '/auth/otp/resend': {
    post: op('Rider', 'Rider login: resend OTP', { auth: false, body: obj({ phone: str({ example: '9876543210' }) }, ['phone']), response: ref('AppOtpSent'), errors: [400, 403, 429] }),
  },
  '/auth/otp/verify': {
    post: op('Rider', 'Rider login: verify OTP, returns tokens', {
      auth: false,
      description: 'A new number gets a rider account immediately (`201`, `isNewUser: true`) with `approvalStatus: pending`; continue with the onboarding screens.',
      body: obj({ phone: str(), otp: str({ pattern: '^\\d{6}$' }) }, ['phone', 'otp']),
      response: obj({ isNewUser: bool(), accessToken: str(), refreshToken: str(), user: ref('AppUser') }),
      errors: [400, 403, 429],
    }),
  },
  '/auth/refresh': {
    post: op('Rider', 'Rider login: new token pair from a refresh token', { auth: false, body: ref('RefreshRequest'), response: ref('TokenPair'), errors: [401] }),
  },
  '/auth/logout': {
    post: appOp('Rider', 'Rider logout: revoke the refresh token and remove the FCM token', { body: obj({ refreshToken: str(), fcmToken: str() }), bodyRequired: false, status: 204 }),
  },
  '/auth/me': { get: appOp('Rider', 'Logged-in rider (same as GET /profile)', { response: ref('AppUser') }) },
  '/profile': {
    get: appOp('Rider', 'Get profile', { response: ref('AppUser') }),
    patch: multipart(appOp('Rider', 'Update profile', { description: 'Same fields as the customer profile.', response: ref('AppUser'), errors: [400] }), { name: str(), photo: binary('JPEG/PNG/WebP up to 5 MB') }, []),
  },
  '/onboarding/options': { get: appOp('Rider', 'Licence choices, vehicle types, services and document types for onboarding') },
  '/onboarding/license': {
    put: appOp('Rider', 'Do you have a driving licence? (Yes / No)', {
      description: '"Yes" = bike taxi + delivery orders. "No" = delivery (transport) orders only, and the licence upload is skipped. Returns the services allowed for the choice.',
      body: obj({ hasLicense: bool() }, ['hasLicense']),
      errors: [400, 409],
    }),
  },
  '/onboarding': {
    post: appOp('Rider', 'Choose type (individual / partner code), vehicle type, services', {
      description: 'Ride services are refused when the rider chose "No licence".',
      body: obj(
        {
          type: enumOf(['individual', 'partner']),
          partnerCode: str({ example: 'P1A2B3C' }),
          vehicleTypeId: oid(),
          services: arr(str({ example: 'bike' })),
          serviceType: enumOf(['rider', 'transport']),
          hasLicense: bool({ description: 'Optional; defaults to the answer saved by PUT /onboarding/license' }),
        },
        ['type', 'vehicleTypeId', 'services'],
      ),
      errors: [400, 409],
    }),
  },
  '/onboarding/status': {
    get: appOp('Rider', 'Documents under verification checklist', {
      response: onboardingStatusResponse,
      description:
        'One row per step: vehicle (selected), driving_license (hidden without a licence), photo_name, vehicle_number, identity (Aadhaar or PAN). Item status: not_submitted, selected, under_review, verified or rejected (with a reason). `status` is pending, under_review, approved or rejected; `nextStep` is the first item to fix.',
    }),
  },
  '/documents': {
    post: multipart(
      appOp('Rider', 'Upload a document (front, back, number)', {
        description:
          'Re-uploading a type replaces it and sends it back for review. Needed for approval: driving_license (front + back, unless the rider has no licence) and one of aadhaar / pan. Number formats: driving licence like KA12345677899029, Aadhaar 12 digits, PAN like ABCDE1234F. vehicle_rc is uploaded with the vehicle (POST /vehicle) or here.',
        status: 201,
        errors: [400, 409],
      }),
      {
        file: binary('Front side. JPEG/PNG/WebP/PDF up to 5 MB'),
        backFile: binary('Back side. Required for driving_license; optional for vehicle_rc and aadhaar'),
        docType: enumOf(RIDER_DOC_TYPES),
        docNumber: str(),
        expiryDate: str({ format: 'date', description: 'Required for insurance, PUC and permit' }),
      },
      ['file', 'docType', 'docNumber'],
    ),
    get: appOp('Rider', 'Documents with verification status'),
  },
  '/vehicle': {
    get: appOp('Rider', 'Current vehicle + pending change requests'),
    post: multipart(
      appOp('Rider', 'Vehicle number screen: register or correct the vehicle', {
        description:
          'JSON or multipart. After onboarding only `registrationNumber` is needed; vehicle type and category come from the onboarding choice. Optional RC photos (`rcFront`, `rcBack`) are saved as the vehicle_rc document. Before approval, sending it again corrects the pending request (200); after approval it files a change request (201). Created inactive; goes live when an admin activates it.',
        status: 201,
        errors: [400, 409],
      }),
      {
        registrationNumber: str({ example: 'MH12AB1234' }),
        vehicleTypeId: oid('Optional: defaults to the onboarding vehicle type'),
        categoryKey: str({ description: 'Optional: defaults to the chosen service for this vehicle type' }),
        model: str({ description: 'Optional: defaults to the vehicle type name' }),
        manufacturer: str(),
        rcFront: binary('RC front side (optional)'),
        rcBack: binary('RC back side (optional)'),
      },
      ['registrationNumber'],
    ),
  },
  '/approval-status': { get: appOp('Rider', 'pending, under_review, approved or rejected + reasons') },
  '/duty/online': {
    post: appOp('Rider', 'Go online', {
      description: '`403` not approved · `428` selfie due (`selfieRequired: true`) · `402` cash dues above `maxCashDues` · `409` no active vehicle.',
      body: obj({ lat: num(), lng: num() }, ['lat', 'lng']),
      errors: [400, 402, 403, 409, 428],
    }),
  },
  '/duty/offline': { post: appOp('Rider', 'Go offline', { errors: [409] }) },
  '/selfie-check': {
    post: multipart(
      appOp('Rider', 'Upload a selfie', {
        description: 'No face-match provider is integrated yet: the selfie is stored for admin review and the check passes (`faceMatch: "not_configured"`).',
        errors: [400],
      }),
      { selfie: binary('JPEG/PNG/WebP') },
      ['selfie'],
    ),
  },
  '/requests/current': { get: appOp('Rider', 'Pending request offered to this rider') },
  '/requests/{bookingId}/accept': { post: appOp('Rider', 'Accept a request (409 if taken or expired)', { parameters: [pathParam('bookingId', 'Booking id', oid())], errors: [409] }) },
  '/requests/{bookingId}/reject': { post: appOp('Rider', 'Reject a request', { parameters: [pathParam('bookingId', 'Booking id', oid())], status: 204, errors: [409] }) },
  '/bookings/active': { get: appOp('Rider', 'Current trip') },
  '/bookings': { get: appOp('Rider', 'Trip history', { parameters: [...pageParams, query('status', 'Comma-separated statuses'), ...reportRange] }) },
  '/bookings/{id}/arrived': { post: appOp('Rider', 'Mark arrived at pickup', { parameters: [bookingIdParam], errors: [404, 409] }) },
  '/bookings/{id}/start': {
    post: multipart(appOp('Rider', 'Verify start/pickup OTP (+ goods photo)', { parameters: [bookingIdParam], errors: [400, 404, 409] }), { otp: str({ example: '4821' }), goodsPhoto: binary('Required for transport') }, ['otp']),
  },
  '/bookings/{id}/stops/{stopId}/complete': {
    post: multipart(
      appOp('Rider', 'Complete a transport drop with OTP + POD', { parameters: [bookingIdParam, pathParam('stopId', 'Stop id', oid())], errors: [400, 404, 409] }),
      { otp: str(), pod: binary('Proof-of-delivery photo') },
      ['otp', 'pod'],
    ),
  },
  '/bookings/{id}/complete': {
    post: appOp('Rider', 'End trip; returns the final fare', {
      description: 'Adds waiting charges beyond `freeWaitingMinutes`. Wallet bookings are charged now; `collectCash` is the amount to collect for cash bookings.',
      parameters: [bookingIdParam],
      errors: [404, 409],
    }),
  },
  '/bookings/{id}/cash-collected': {
    post: appOp('Rider', 'Confirm cash received', { description: 'Marks the booking paid; the platform commission is added to the rider wallet as dues.', parameters: [bookingIdParam], errors: [404, 409] }),
  },
  '/bookings/{id}/cancel': {
    post: appOp('Rider', 'Cancel with reason', {
      description: 'Allowed before the trip starts; the booking goes back to searching for another rider.',
      parameters: [bookingIdParam],
      body: obj({ reason: str() }, ['reason']),
      status: 204,
      errors: [400, 409],
    }),
  },
  '/bookings/{id}/rating': {
    post: appOp('Rider', 'Rate the customer', { parameters: [bookingIdParam], body: obj({ score: int({ minimum: 1, maximum: 5 }), comment: str() }, ['score']), status: 201, errors: [400, 404, 409] }),
  },
  '/earnings': { get: appOp('Rider', 'Earnings summary and per-trip breakdown', { description: 'Defaults to the last 7 days.', parameters: reportRange }) },
  '/wallet': { get: appOp('Rider', 'Balance, dues, transactions', { parameters: pageParams }) },
  '/wallet/pay-dues': {
    post: appOp('Rider', 'Gateway order to clear dues', { body: obj({ amount: num({ description: 'Defaults to all dues' }) }), bodyRequired: false, response: gatewayOrder, status: 201, errors: [400, 409, 503] }),
  },
  '/payments/verify': { post: appOp('Rider', 'Verify a dues payment', { body: verifyBody, errors: [400, 404] }) },
  '/withdrawals': {
    post: appOp('Rider', 'Request a payout to bank/UPI', {
      description: 'Minimum `minWithdrawalAmount` (default ₹100). The amount is held from the wallet; one payout in progress at a time.',
      body: obj(
        { amount: num(), method: enumOf(['bank', 'upi']), upiId: str({ example: 'name@okaxis' }), bankAccount: obj({ holderName: str(), accountNumber: str(), ifsc: str({ example: 'HDFC0001234' }) }) },
        ['amount', 'method'],
      ),
      status: 201,
      errors: [400, 402, 409],
    }),
    get: appOp('Rider', 'Payout history', { parameters: pageParams }),
  },
  '/incentives': { get: appOp('Rider', 'Active incentive schemes + progress') },
  '/heatmap': {
    get: appOp('Rider', 'Demand zones', {
      description: 'Open requests vs online riders per ~1 km cell over the last hour, within 10 km.',
      parameters: [query('lat', 'Defaults to your last location', num()), query('lng', 'Defaults to your last location', num())],
    }),
  },
  ...supportPaths('Rider'),
}

const commonPaths = {
  '/common/app-config': { get: op('Common', 'Min version, feature flags, support numbers', { auth: false, parameters: [query('app', 'customer or rider', enumOf(['customer', 'rider']))] }) },
  '/common/cms/{slug}': { get: op('Common', 'Terms, privacy, FAQs', { auth: false, parameters: [pathParam('slug', 'Page', enumOf(CMS_SLUGS))], errors: [404] }) },
  '/common/devices': {
    post: appOp('Common', 'Register an FCM token', { body: obj({ token: str(), platform: enumOf(['android', 'ios', 'web']), appVersion: str() }, ['token']), status: 201, errors: [400] }),
  },
  '/public/track/{token}': { get: op('Public', 'Public tracking page data (share link)', { auth: false, parameters: [pathParam('token', 'Share token')], errors: [404] }) },
  '/public/invoices/{token}': { get: op('Public', 'Invoice PDF', { auth: false, parameters: [pathParam('token', 'Invoice token')], errors: [404] }) },
}

const SOCKET_DOCS = [
  '### Socket.IO (SRS §10.6)',
  'Connect to `/customer`, `/rider` (app access token) or `/admin` (admin access token) with `auth: { token }`. Clients join `booking:<id>` for their active booking automatically; emit `booking:join` `{ bookingId }` to join one explicitly.',
  '',
  '| Event | Direction | Payload |',
  '|---|---|---|',
  '| `rider:location` | Rider → Server | lat, lng, heading, speed, timestamp |',
  '| `booking:request` | Server → Rider | bookingId, mode, pickup, drop, stops, earning, expiresAt |',
  '| `booking:request_expired` | Server → Rider | bookingId |',
  '| `booking:status` | Server → Customer, Admin | bookingId, status, timestamp |',
  '| `booking:rider_assigned` | Server → Customer | rider, vehicle, etaMin |',
  '| `booking:rider_location` | Server → Customer | lat, lng, heading, etaMin |',
  '| `booking:fare_updated` | Server → Customer, Rider | fare, distanceKm, drop |',
  '| `booking:cancelled` | Server → both | by, reason, charge |',
  '| `chat:message` | both ways | bookingId, text (the ack returns the stored message) |',
  '| `sos:alert` | Server → Admin | sosId, user, booking, location |',
  '| `admin:live_riders` | Server → Admin | zoneId, zoneName, riders[] (every 5 s) |',
].join('\n')

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Rider & Transport Admin API',
    version: '1.0.0',
    description: [
      'REST API for the AnZ Cabs admin panel (`/admin/*`) and the mobile apps (`/auth/*`, `/customer/*`, `/rider/*`, `/app/*`).',
      '',
      '### Admin APIs',
      '1. `POST /admin/auth/login` with email + password. When admin OTP is on (Settings → Security, default on), the response has `otpRequired: true` and an `otpToken`, and a 6-digit OTP is sent by SMS to the phone on the admin account.',
      '2. `POST /admin/auth/login/verify-otp` with the `otpToken` and `otp` returns the tokens.',
      '3. Click **Authorize** and paste the `accessToken` into **bearerAuth**.',
      '',
      'Most admin endpoints also need a role permission, shown in each description; a missing permission returns `403`.',
      '',
      '### Mobile app APIs',
      'Customer app: `POST /app/auth/otp/send` → `POST /app/auth/otp/verify` (`userType: customer`), then `/customer/*`. Rider app: `POST /rider/auth/otp/send` → `POST /rider/auth/otp/verify`, then `/rider/*`. Paste the app `accessToken` into **appBearerAuth**. App and admin tokens are not interchangeable.',
      '',
      'The earlier `/app/*` APIs (with a separate `/app/auth/register` step) are still served and are used by the current Flutter app.',
      '',
      'In development the OTP is also returned as `devOtp` and printed in the server console. It is never returned in production.',
      '',
      SOCKET_DOCS,
    ].join('\n'),
  },
  servers: [{ url: `http://localhost:${env.port}/api/v1`, description: 'Local' }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: 'Customer', description: 'SRS §10.2: customer app' },
    { name: 'Rider', description: 'SRS §10.3: rider app' },
    { name: 'Common', description: 'SRS §10.5: app config, CMS, push devices' },
    { name: 'Public', description: 'Pages opened from shared links, no login' },
    { name: 'App Auth', description: 'Phone + OTP login for the customer, rider/driver and partner apps' },
    { name: 'App Profile', description: 'The app Profile screen: name, email, gender, date of birth, emergency contact' },
    { name: 'Admin Auth', description: 'Admin email/password login with an OTP second step' },
    { name: 'Dashboard' },
    { name: 'Admins' },
    { name: 'Roles' },
    { name: 'Audit Logs' },
    { name: 'Settings' },
    { name: 'Customers' },
    { name: 'Drivers' },
    { name: 'Partners' },
    { name: 'Bookings' },
    { name: 'Service Categories' },
    { name: 'SOS' },
    { name: 'Vehicles' },
    { name: 'Vehicle Types' },
    { name: 'Documents' },
    { name: 'Pricing' },
    { name: 'Commissions' },
    { name: 'Payments' },
    { name: 'Refunds' },
    { name: 'Wallets' },
    { name: 'Settlements' },
    { name: 'Coupons' },
    { name: 'Banners' },
    { name: 'Notifications' },
    { name: 'CMS' },
    { name: 'Service Areas' },
    { name: 'Tickets' },
    { name: 'Ratings' },
    { name: 'Reports' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Admin access token' },
      appBearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Mobile app access token' },
    },
    parameters: {
      Id: pathParam('id', 'MongoDB ObjectId', oid()),
      Page: query('page', 'Page number (1-based)', int({ minimum: 1, default: 1 })),
      Limit: query('limit', 'Items per page (max 100)', int({ minimum: 1, maximum: 100, default: 20 })),
    },
    responses: {
      E400: { description: 'Validation error', ...json(ref('Error')) },
      E401: { description: 'Missing, invalid or expired token', ...json(ref('Error')) },
      E403: { description: 'Missing permission', ...json(ref('Error')) },
      E404: { description: 'Not found', ...json(ref('Error')) },
      E402: { description: 'Payment needed (insufficient wallet balance, or dues to clear)', ...json(ref('Error')) },
      E409: { description: 'Conflict: duplicate, or not allowed in the current state', ...json(ref('Error')) },
      E422: { description: 'Location not serviceable', ...json(ref('Error')) },
      E428: { description: 'Selfie check due before going online', ...json(ref('Error')) },
      E503: { description: 'Provider not configured', ...json(ref('Error')) },
      E429: { description: 'Rate limited (too many attempts or OTP requests)', ...json(ref('OtpError')) },
    },
    schemas: {
      Error: obj({ message: str({ example: 'Unauthorized' }) }, ['message']),
      Paginated: obj({ items: arr(anyObj), total: int(), page: int(), limit: int() }),
      PaginatedPageSize: obj({ items: arr(anyObj), total: int(), page: int(), pageSize: int() }),

      // Auth
      LoginRequest: obj({ email: str({ format: 'email', example: 'admin@rideflow.demo' }), password: str({ example: 'password' }) }, ['email', 'password']),
      AuthUser: obj({
        id: oid(),
        name: str(),
        email: str(),
        role: enumOf(ROLE_KEYS),
        roleName: str(),
        permissions: arr(enumOf(PERMISSION_KEYS)),
      }),
      LoginResponse: obj({ accessToken: str(), refreshToken: str(), user: ref('AuthUser') }),
      OtpError: obj(
        {
          message: str({ example: 'Incorrect OTP.' }),
          attemptsLeft: int({ description: 'Present after a wrong code' }),
          retryAfterSeconds: int({ description: 'Present when rate limited' }),
        },
        ['message'],
      ),
      AdminOtpChallenge: obj({
        otpRequired: bool({ example: true }),
        otpToken: str({ description: 'Short-lived (10 min) token identifying this sign-in attempt' }),
        maskedPhone: str({ example: '******1223' }),
        expiresInSeconds: int({ example: 300 }),
        resendAfterSeconds: int({ example: 30 }),
        devOtp: str({ example: '123456', description: 'Development only' }),
      }),
      VerifyLoginOtpRequest: obj({ otpToken: str(), otp: str({ example: '123456', pattern: '^\\d{6}$' }) }, ['otpToken', 'otp']),
      ResendLoginOtpRequest: obj({ otpToken: str() }, ['otpToken']),
      OtpResent: obj({
        maskedPhone: str({ example: '******1223' }),
        expiresInSeconds: int({ example: 300 }),
        resendAfterSeconds: int({ example: 30 }),
        devOtp: str({ example: '123456', description: 'Development only' }),
      }),

      // Mobile app auth
      AppOtpSent: obj({
        message: str({ example: 'OTP sent' }),
        phone: str({ example: '******3210' }),
        expiresInSeconds: int({ example: 300 }),
        resendAfterSeconds: int({ example: 30 }),
        devOtp: str({ example: '123456', description: 'Development only' }),
      }),
      AppUser: {
        type: 'object',
        description: 'The Customer, Driver or TransportPartner record, plus `userType`.',
        properties: {
          id: oid(),
          userType: enumOf(['customer', 'driver', 'partner']),
          phone: str({ example: '+919876543210' }),
          name: str({ description: 'customer / driver' }),
          companyName: str({ description: 'partner' }),
          ownerName: str({ description: 'partner' }),
          email: str(),
          status: enumOf(ACCOUNT_STATUS),
          approvalStatus: enumOf(APPROVAL_STATUS, { description: 'driver / partner' }),
          serviceType: enumOf(['rider', 'transport'], { description: 'driver' }),
          gender: enumOf(GENDERS, { description: 'customer / driver' }),
          dateOfBirth: date({ example: '1995-08-14T00:00:00.000Z', description: 'customer / driver (UTC midnight of the date)' }),
          emergencyContact: ref('EmergencyContact'),
          profileComplete: bool({ description: 'false → show the Profile screen' }),
        },
        additionalProperties: true,
      },
      EmergencyContact: obj(
        {
          name: str({ example: 'Riya Patel' }),
          phone: str({ example: '9876543222', description: 'Indian mobile; stored as +91XXXXXXXXXX. Must differ from the user’s own number.' }),
        },
        ['name', 'phone'],
      ),
      AppProfileUpdate: obj({
        name: str({ example: 'Aarav Patel', minLength: 2, maxLength: 80 }),
        email: { ...str({ format: 'email' }), nullable: true },
        gender: { ...enumOf(GENDERS), nullable: true },
        dateOfBirth: { ...str({ format: 'date', example: '1995-08-14' }), nullable: true },
        emergencyContact: ref('EmergencyContact'),
        city: str({ description: 'customer' }),
        companyName: str({ description: 'partner' }),
        ownerName: str({ description: 'partner' }),
        businessRegNo: str({ description: 'partner' }),
        taxId: str({ description: 'partner' }),
      }),
      AppAuthTokens: obj({ accessToken: str(), refreshToken: str(), user: ref('AppUser') }),
      AppAuthExistingUser: { allOf: [obj({ isNewUser: bool({ example: false }) }), ref('AppAuthTokens')] },
      AppAuthNewUser: obj({
        isNewUser: bool({ example: true }),
        registrationToken: str({ description: 'Pass to /auth/register within 30 minutes' }),
      }),
      AppRegisterRequest: obj(
        {
          registrationToken: str(),
          name: str({ example: 'Aarav Patel', description: 'customer / driver (required)' }),
          email: str({ format: 'email' }),
          gender: enumOf(GENDERS, { description: 'customer / driver' }),
          dateOfBirth: str({ format: 'date', example: '1995-08-14', description: 'customer / driver, YYYY-MM-DD' }),
          emergencyContact: ref('EmergencyContact'),
          city: str({ description: 'customer' }),
          serviceType: enumOf(['rider', 'transport'], { description: 'driver' }),
          companyName: str({ description: 'partner' }),
          ownerName: str({ description: 'partner' }),
          businessRegNo: str({ description: 'partner' }),
          taxId: str({ description: 'partner' }),
        },
        ['registrationToken'],
      ),
      RefreshRequest: obj({ refreshToken: str() }, ['refreshToken']),
      TokenPair: obj({ accessToken: str(), refreshToken: str() }),

      // Admins & roles
      Admin: entity({
        name: str(),
        email: str(),
        phone: str(),
        role: enumOf(ROLE_KEYS),
        status: enumOf(['active', 'suspended']),
        avatarColor: str(),
        lastLoginAt: date({ nullable: true }),
      }, 'id'),
      AdminCreate: obj(
        { name: str(), email: str({ format: 'email' }), phone: str(), role: enumOf(ROLE_KEYS) },
        ['name', 'email', 'phone', 'role'],
      ),
      AdminUpdate: obj({ name: str(), phone: str(), role: enumOf(ROLE_KEYS), status: enumOf(['active', 'suspended']) }),
      Role: entity({ key: enumOf(ROLE_KEYS), name: str(), description: str(), permissions: arr(enumOf(PERMISSION_KEYS)), isSystem: bool() }),
      RolePermissionsUpdate: obj({ permissions: arr(enumOf(PERMISSION_KEYS)) }, ['permissions']),
      AuditLog: entity({
        actorId: oid(),
        actorName: str(),
        actorRole: enumOf(ROLE_KEYS),
        action: str({ example: 'admin.create' }),
        targetType: str(),
        targetLabel: str(),
        metadata: anyObj,
      }),

      // Settings
      Settings: obj({
        platformName: str(),
        supportEmail: str(),
        supportPhone: str(),
        defaultCurrency: str({ example: 'INR' }),
        defaultCountry: str({ example: 'India' }),
        rideServiceEnabled: bool(),
        transportServiceEnabled: bool(),
        maintenanceMode: bool(),
        otpExpiryMinutes: int({ description: 'Validity of admin and app OTPs' }),
        adminLoginOtpEnabled: bool({ description: 'Require an SMS OTP after the admin password' }),
        accessTokenTtlMinutes: int(),
        refreshTokenTtlDays: int(),
      }),

      // Users
      Customer: entity({ name: str(), email: str(), phone: str(), city: str(), status: enumOf(ACCOUNT_STATUS), totalBookings: int(), rating: num() }, 'id'),
      CustomerStatusUpdate: obj({ status: enumOf(ACCOUNT_STATUS) }, ['status']),
      Driver: entity({
        name: str(),
        email: str(),
        phone: str(),
        serviceType: enumOf(['rider', 'transport']),
        approvalStatus: enumOf(APPROVAL_STATUS),
        status: enumOf(ACCOUNT_STATUS),
        onlineStatus: enumOf(['offline', 'online', 'busy', 'on_trip']),
        currentLocation: anyObj,
        assignedVehicle: { ...oid(), nullable: true },
        rating: num(),
        totalTrips: int(),
        cancellations: int(),
        earnings: num(),
      }, 'id'),
      ApprovalStatusUpdate: obj({ approvalStatus: enumOf(APPROVAL_STATUS), status: enumOf(ACCOUNT_STATUS) }),
      Partner: entity({
        companyName: str(),
        ownerName: str(),
        email: str(),
        phone: str(),
        businessRegNo: str(),
        taxId: str(),
        approvalStatus: enumOf(APPROVAL_STATUS),
        status: enumOf(ACCOUNT_STATUS),
        vehicleCount: int(),
        driverCount: int(),
      }),

      // Bookings
      Booking: entity({
        bookingCode: str(),
        mode: enumOf(SERVICE_MODE),
        categoryKey: str(),
        status: enumOf(BOOKING_STATUS),
        paymentStatus: enumOf(['pending', 'paid', 'failed', 'refunded']),
        paymentMethod: enumOf(['cash', 'upi', 'card', 'wallet', 'netbanking']),
        customer: anyObj,
        driver: { ...anyObj, nullable: true },
        vehicle: { ...anyObj, nullable: true },
        fare: anyObj,
        timeline: arr(obj({ status: str(), at: date(), note: str() })),
        cancellation: obj({ by: enumOf(['customer', 'driver', 'admin']), reason: str(), chargedAmount: num() }),
      }),
      BookingAssign: obj({ driverId: oid(), vehicleId: oid('Optional') }, ['driverId']),
      BookingStatusUpdate: obj(
        {
          status: enumOf(BOOKING_STATUS),
          note: str(),
          cancelledBy: enumOf(['customer', 'driver', 'admin'], { description: 'Only used when status is cancelled' }),
          reason: str({ description: 'Cancellation reason' }),
        },
        ['status'],
      ),
      Category: entity({
        mode: enumOf(SERVICE_MODE),
        key: str(),
        name: str(),
        description: str(),
        icon: str(),
        seats: int(),
        capacityLabel: str(),
        vehicleType: { ...anyObj, nullable: true },
        status: enumOf(ACTIVE_INACTIVE),
        sortOrder: int(),
      }),
      CategoryCreate: obj(
        {
          mode: enumOf(SERVICE_MODE),
          key: str({ example: 'bike' }),
          name: str({ example: 'Bike' }),
          description: str(),
          icon: str(),
          seats: int(),
          capacityLabel: str(),
          vehicleType: oid('VehicleType id'),
          status: enumOf(ACTIVE_INACTIVE),
          sortOrder: int(),
        },
        ['mode', 'key', 'name'],
      ),
      CategoryUpdate: obj({
        name: str(),
        description: str(),
        icon: str(),
        seats: int(),
        capacityLabel: str(),
        vehicleType: { ...oid('VehicleType id'), nullable: true },
        status: enumOf(ACTIVE_INACTIVE),
        sortOrder: int(),
      }),
      SosRequest: entity({
        booking: anyObj,
        raisedBy: enumOf(['customer', 'driver']),
        userName: str(),
        location: anyObj,
        status: enumOf(['open', 'acknowledged', 'resolved']),
        notes: arr(obj({ by: str(), text: str(), at: date() })),
        resolvedAt: date({ nullable: true }),
      }),
      SosUpdate: obj({ status: enumOf(['open', 'acknowledged', 'resolved']), note: str({ description: 'Appended to the notes list' }) }),

      // Fleet
      Vehicle: entity({
        registrationNumber: str(),
        model: str(),
        manufacturer: str(),
        vehicleType: anyObj,
        serviceMode: enumOf(SERVICE_MODE),
        categoryKey: str(),
        ownerType: enumOf(['driver', 'partner']),
        ownerId: oid(),
        ownerLabel: str(),
        capacity: str(),
        status: enumOf(['active', 'inactive', 'blocked']),
        documentsStatus: enumOf(DOC_STATUS),
      }),
      VehicleCreate: obj(
        {
          registrationNumber: str({ example: 'MH12AB1234' }),
          model: str(),
          manufacturer: str(),
          vehicleType: oid('VehicleType id'),
          serviceMode: enumOf(SERVICE_MODE),
          categoryKey: str(),
          ownerType: enumOf(['driver', 'partner']),
          ownerId: oid('Driver or TransportPartner id'),
          capacity: str(),
        },
        ['registrationNumber', 'model', 'vehicleType', 'serviceMode', 'categoryKey', 'ownerType', 'ownerId'],
      ),
      VehicleUpdate: obj({
        model: str(),
        manufacturer: str(),
        vehicleType: oid(),
        capacity: str(),
        status: enumOf(['active', 'inactive', 'blocked']),
        documentsStatus: enumOf(DOC_STATUS),
      }),
      VehicleType: entity({ name: str(), serviceMode: enumOf(SERVICE_MODE), capacityLabel: str(), status: enumOf(ACTIVE_INACTIVE) }),
      VehicleTypeCreate: obj({ name: str(), serviceMode: enumOf(SERVICE_MODE), capacityLabel: str() }, ['name', 'serviceMode']),
      VehicleTypeUpdate: obj({ name: str(), serviceMode: enumOf(SERVICE_MODE), capacityLabel: str(), status: enumOf(ACTIVE_INACTIVE) }),
      Document: entity({
        ownerType: enumOf(['driver', 'partner', 'vehicle']),
        ownerId: oid(),
        docType: str(),
        fileUrl: str(),
        expiryDate: date({ nullable: true }),
        status: enumOf(DOC_STATUS),
        rejectionReason: str(),
        reviewedBy: oid(),
        reviewedAt: date(),
      }),
      DocumentCreate: obj(
        {
          ownerType: enumOf(['driver', 'partner', 'vehicle']),
          ownerId: oid(),
          docType: str({ example: 'driving_license' }),
          fileUrl: str({ format: 'uri' }),
          expiryDate: str({ format: 'date' }),
        },
        ['ownerType', 'ownerId', 'docType', 'fileUrl'],
      ),
      DocumentStatusUpdate: obj(
        { status: enumOf(DOC_STATUS), rejectionReason: str({ description: 'Required when status is rejected' }) },
        ['status'],
      ),

      // Finance
      PricingRule: entity({
        mode: enumOf(SERVICE_MODE),
        categoryKey: str(),
        serviceArea: { ...oid(), nullable: true },
        baseFare: num(),
        perKm: num(),
        perMinute: num(),
        minimumFare: num(),
        waitingChargePerMin: num(),
        nightChargeMultiplier: num(),
        platformFeeFlat: num(),
        platformFeePercent: num(),
        cancellationFee: num(),
        loadingUnloadingCharge: num(),
        additionalStopCharge: num(),
        taxPercent: num(),
        effectiveFrom: date(),
        status: enumOf(ACTIVE_INACTIVE),
      }),
      PricingRuleInput: obj(
        {
          mode: enumOf(SERVICE_MODE),
          categoryKey: str({ example: 'bike' }),
          serviceArea: { ...oid('ServiceArea id'), nullable: true },
          baseFare: num({ example: 25 }),
          perKm: num({ example: 8 }),
          perMinute: num(),
          minimumFare: num({ example: 40 }),
          waitingChargePerMin: num(),
          nightChargeMultiplier: num(),
          platformFeeFlat: num(),
          platformFeePercent: num(),
          cancellationFee: num(),
          loadingUnloadingCharge: num(),
          additionalStopCharge: num(),
          taxPercent: num(),
          effectiveFrom: date(),
          status: enumOf(ACTIVE_INACTIVE),
        },
        ['mode', 'categoryKey', 'baseFare', 'perKm', 'minimumFare'],
      ),
      CommissionRule: entity({
        appliesTo: enumOf(['driver', 'partner']),
        categoryKey: str(),
        type: enumOf(['percentage', 'fixed']),
        value: num(),
        effectiveFrom: date(),
        status: enumOf(ACTIVE_INACTIVE),
      }),
      CommissionRuleInput: obj(
        {
          appliesTo: enumOf(['driver', 'partner']),
          categoryKey: str(),
          type: enumOf(['percentage', 'fixed']),
          value: num({ example: 15 }),
          effectiveFrom: date(),
          status: enumOf(ACTIVE_INACTIVE),
        },
        ['appliesTo', 'type', 'value'],
      ),
      Payment: entity({
        booking: anyObj,
        amount: num(),
        method: enumOf(['cash', 'upi', 'card', 'netbanking', 'wallet']),
        gateway: enumOf(['razorpay', 'stripe', 'cash', 'internal']),
        gatewayRefId: str(),
        status: enumOf(['initiated', 'success', 'failed', 'refunded']),
      }),
      Refund: entity({
        booking: anyObj,
        payment: oid(),
        amount: num(),
        reason: str(),
        requestedBy: str(),
        status: enumOf(['requested', 'approved', 'rejected', 'processed']),
        approvedBy: oid(),
        processedAt: date({ nullable: true }),
      }),
      Wallet: entity({
        ownerType: enumOf(['customer', 'driver', 'partner']),
        ownerId: oid(),
        ownerName: str(),
        balance: num(),
        currency: str({ example: 'INR' }),
      }),
      WalletTransaction: entity({
        wallet: oid(),
        type: enumOf(['credit', 'debit']),
        amount: num(),
        reason: enumOf(WALLET_REASONS),
        referenceType: str(),
        referenceId: oid(),
        balanceAfter: num(),
        createdBy: oid(),
      }),
      WalletAdjust: obj(
        {
          type: enumOf(['credit', 'debit']),
          amount: num({ minimum: 0, exclusiveMinimum: true, example: 100 }),
          reason: enumOf(WALLET_REASONS, { description: 'Defaults to adjustment when missing or unknown' }),
        },
        ['type', 'amount'],
      ),
      Settlement: entity({
        payeeType: enumOf(['driver', 'partner']),
        payeeId: oid(),
        payeeName: str(),
        periodStart: date(),
        periodEnd: date(),
        grossEarnings: num(),
        commissionDeducted: num(),
        netPayable: num(),
        status: enumOf(['pending', 'processing', 'paid']),
        paidAt: date({ nullable: true }),
      }),

      // Marketing
      Coupon: entity({
        code: str(),
        title: str(),
        autoApply: bool(),
        discountType: enumOf(['flat', 'percentage']),
        amount: num(),
        minBookingAmount: num(),
        maxDiscount: num(),
        validFrom: date(),
        validTo: date(),
        usageLimitTotal: int(),
        usageLimitPerUser: int(),
        usedCount: int(),
        applicableMode: enumOf(SERVICE_MODE_BOTH),
        applicableCategories: arr(str()),
        serviceAreas: arr(oid()),
        status: enumOf(ACTIVE_INACTIVE),
      }),
      CouponInput: obj(
        {
          code: str({ example: 'WELCOME50', description: 'Leave empty for auto-apply offers' }),
          title: str({ example: 'Welcome offer' }),
          autoApply: bool({ description: 'true = offer, false = coupon code' }),
          discountType: enumOf(['flat', 'percentage']),
          amount: num({ example: 50 }),
          minBookingAmount: num(),
          maxDiscount: num(),
          validFrom: date(),
          validTo: date(),
          usageLimitTotal: int(),
          usageLimitPerUser: int(),
          applicableMode: enumOf(SERVICE_MODE_BOTH),
          applicableCategories: arr(str()),
          serviceAreas: arr(oid()),
          status: enumOf(ACTIVE_INACTIVE),
        },
        ['title', 'discountType', 'amount', 'validFrom', 'validTo'],
      ),
      Banner: entity({
        title: str(),
        description: str(),
        imageUrl: str(),
        ctaLabel: str(),
        targetLink: str(),
        serviceMode: enumOf(SERVICE_MODE_BOTH),
        startDate: date(),
        endDate: date(),
        status: enumOf(ACTIVE_INACTIVE),
      }),
      BannerInput: obj(
        {
          title: str(),
          description: str(),
          imageUrl: str({ format: 'uri' }),
          ctaLabel: str(),
          targetLink: str(),
          serviceMode: enumOf(SERVICE_MODE_BOTH),
          startDate: date(),
          endDate: date(),
          status: enumOf(ACTIVE_INACTIVE),
        },
        ['title', 'imageUrl', 'startDate', 'endDate'],
      ),
      NotificationTemplate: entity({
        key: str(),
        channel: enumOf(['push', 'sms', 'email']),
        title: str(),
        body: str(),
        status: enumOf(ACTIVE_INACTIVE),
      }),
      NotificationTemplateInput: obj(
        {
          key: str({ example: 'booking_confirmed' }),
          channel: enumOf(['push', 'sms', 'email']),
          title: str(),
          body: str(),
          status: enumOf(ACTIVE_INACTIVE),
        },
        ['key', 'channel', 'body'],
      ),
      NotificationBroadcast: entity({
        template: { ...anyObj, nullable: true },
        channel: enumOf(['push', 'sms', 'email']),
        audience: enumOf(['all_customers', 'all_drivers', 'all_partners', 'custom']),
        serviceModeFilter: enumOf(SERVICE_MODE_BOTH),
        title: str(),
        body: str(),
        sentBy: oid(),
        recipientCountEstimate: int(),
      }),
      NotificationBroadcastInput: obj(
        {
          templateId: { ...oid('Optional template id'), nullable: true },
          channel: enumOf(['push', 'sms', 'email']),
          audience: enumOf(['all_customers', 'all_drivers', 'all_partners', 'custom']),
          serviceModeFilter: enumOf(SERVICE_MODE_BOTH, { default: 'both' }),
          title: str(),
          body: str(),
        },
        ['channel', 'audience', 'title', 'body'],
      ),
      CmsPage: entity({ slug: enumOf(CMS_SLUGS), title: str(), content: str(), updatedBy: oid() }),
      CmsPageUpdate: obj({ title: str(), content: str({ description: 'HTML or Markdown content' }) }),

      // Settings: service areas
      ServiceArea: entity({
        name: str(),
        country: str(),
        state: str(),
        city: str(),
        zone: str(),
        status: enumOf(ACTIVE_INACTIVE),
        rideEnabled: bool(),
        transportEnabled: bool(),
        geofence: obj({ centerLat: num(), centerLng: num(), radiusKm: num() }),
      }),
      ServiceAreaInput: obj(
        {
          name: str({ example: 'Pune Central' }),
          country: str({ example: 'India' }),
          state: str({ example: 'Maharashtra' }),
          city: str({ example: 'Pune' }),
          zone: str(),
          status: enumOf(ACTIVE_INACTIVE),
          rideEnabled: bool(),
          transportEnabled: bool(),
          geofence: obj({ centerLat: num(), centerLng: num(), radiusKm: num() }),
        },
        ['name', 'country', 'state', 'city'],
      ),

      // Support
      Ticket: entity({
        subject: str(),
        category: enumOf(['payment', 'booking', 'driver', 'vehicle', 'lost_item', 'refund', 'cancellation', 'technical']),
        raisedByType: enumOf(['customer', 'driver', 'partner']),
        raisedByName: str(),
        booking: { ...oid(), nullable: true },
        status: enumOf(['open', 'assigned', 'in_progress', 'resolved', 'closed']),
        priority: enumOf(['low', 'medium', 'high']),
        assignedTo: { ...anyObj, nullable: true },
        notes: arr(obj({ by: str(), text: str(), at: date() })),
        resolvedAt: date({ nullable: true }),
      }),
      TicketUpdate: obj({
        status: enumOf(['open', 'assigned', 'in_progress', 'resolved', 'closed']),
        priority: enumOf(['low', 'medium', 'high']),
        assignedTo: { ...oid('Admin id; null to unassign'), nullable: true },
        note: str({ description: 'Appended to the notes list' }),
      }),
      Rating: entity({
        booking: anyObj,
        customer: anyObj,
        driver: anyObj,
        ratedBy: enumOf(['customer', 'driver']),
        score: num({ minimum: 1, maximum: 5 }),
        comment: str(),
      }),

      // Reports
      BookingReport: obj({
        summary: obj({ total: int(), completed: int(), cancelled: int(), totalFare: num() }),
        rows: arr(
          obj({
            bookingCode: str(),
            mode: str(),
            categoryKey: str(),
            customerName: str(),
            driverName: str(),
            status: str(),
            fareTotal: num(),
            createdAt: date(),
          }),
        ),
      }),
      RevenueReport: obj({
        summary: obj({ grossRevenue: num(), platformCommission: num(), refunds: num(), netRevenue: num() }),
        byDay: arr(obj({ date: str({ example: '2026-09-24' }), revenue: num() })),
      }),
      RiderReport: obj({
        rows: arr(
          obj({
            driverName: str(),
            serviceType: str(),
            totalTrips: int(),
            completedInRange: int(),
            cancelledInRange: int(),
            earnings: num(),
            rating: num(),
          }),
        ),
      }),
      PartnerReport: obj({
        rows: arr(
          obj({
            companyName: str(),
            vehicleCount: int(),
            driverCount: int(),
            deliveriesInRange: int(),
            revenueInRange: num(),
            status: str(),
          }),
        ),
      }),
      FinancialReport: obj({
        summary: obj({ grossRevenue: num(), refunds: num(), netRevenue: num(), walletCreditsTotal: num(), walletDebitsTotal: num() }),
        rows: arr(
          obj({ date: str(), paymentsCount: int(), paymentsAmount: num(), refundsCount: int(), refundsAmount: num() }),
        ),
      }),
    },
  },
  paths: {
    ...prefixPaths('/customer', customerPaths),
    ...prefixPaths('/rider', riderPaths),
    ...commonPaths,
    ...prefixPaths('/app', appPaths),
    ...prefixPaths('/admin', {
    // ---------------- Auth ----------------
    '/auth/login': {
      post: op('Admin Auth', 'Step 1: log in with email and password', {
        auth: false,
        description: [
          'Rate-limited to 10 attempts per 15 minutes. Suspended accounts get `403`.',
          'When admin OTP is enabled (default), returns an `AdminOtpChallenge` and sends an OTP by SMS; finish with `/admin/auth/login/verify-otp`. When disabled, returns tokens directly.',
        ].join('\n\n'),
        body: ref('LoginRequest'),
        response: { oneOf: [ref('AdminOtpChallenge'), ref('LoginResponse')] },
        errors: [400, 403, 429],
      }),
    },
    '/auth/login/verify-otp': {
      post: op('Admin Auth', 'Step 2: verify the login OTP', {
        auth: false,
        description: 'Returns tokens on success. Wrong codes return `attemptsLeft`. `401` means the `otpToken` expired and the admin must sign in again.',
        body: ref('VerifyLoginOtpRequest'),
        response: ref('LoginResponse'),
        errors: [400, 429],
      }),
    },
    '/auth/login/resend-otp': {
      post: op('Admin Auth', 'Resend the login OTP', {
        auth: false,
        body: ref('ResendLoginOtpRequest'),
        response: ref('OtpResent'),
        errors: [429],
      }),
    },
    '/auth/refresh': {
      post: op('Admin Auth', 'Exchange a refresh token for a new token pair', {
        auth: false,
        body: ref('RefreshRequest'),
        response: ref('TokenPair'),
        errors: [401],
      }),
    },
    '/auth/logout': {
      post: op('Admin Auth', 'Log out (records an audit entry)', { status: 204 }),
    },
    '/auth/me': {
      get: op('Admin Auth', 'Current admin with role permissions', { response: ref('AuthUser') }),
    },

    // ---------------- Dashboard ----------------
    '/dashboard/stats': {
      get: op('Dashboard', 'Live dashboard KPIs', {
        permission: 'dashboard.view',
        description: 'Totals, today’s bookings and revenue, 30-day ride/transport split and status mix, 7-day revenue trend, recent bookings, pending approvals and alerts, all computed live.',
      }),
    },

    // ---------------- Admins / Roles / Audit ----------------
    '/admins': {
      get: op('Admins', 'List admin users', { permission: 'admins.view', response: listOf('Admin') }),
      post: op('Admins', 'Create an admin user', {
        permission: 'admins.manage',
        description: 'The new admin gets the default seed password (`SEED_ADMIN_PASSWORD`).',
        body: ref('AdminCreate'),
        response: ref('Admin'),
        status: 201,
        errors: [400, 409],
      }),
    },
    '/admins/{id}': {
      patch: op('Admins', 'Update an admin user', {
        permission: 'admins.manage',
        description: 'You cannot suspend or demote your own Super Admin account.',
        parameters: [idParam],
        body: ref('AdminUpdate'),
        response: ref('Admin'),
        errors: [400, 404],
      }),
    },
    '/roles': {
      get: op('Roles', 'List roles and their permissions', { permission: 'roles.view', response: listOf('Role') }),
    },
    '/roles/{key}': {
      patch: op('Roles', "Replace a role's permission list", {
        permission: 'roles.manage',
        parameters: [pathParam('key', 'Role key', enumOf(ROLE_KEYS))],
        body: ref('RolePermissionsUpdate'),
        response: ref('Role'),
        errors: [400, 404],
      }),
    },
    '/audit-logs': {
      get: op('Audit Logs', 'Latest 500 audit log entries', { permission: 'audit_logs.view', response: listOf('AuditLog') }),
    },

    // ---------------- Settings ----------------
    '/settings': {
      get: op('Settings', 'Get platform settings', { permission: 'settings.view', response: ref('Settings') }),
      patch: op('Settings', 'Update platform settings', {
        permission: 'settings.manage',
        description: 'Send only the fields to change.',
        body: ref('Settings'),
        response: ref('Settings'),
      }),
    },

    // ---------------- Users ----------------
    '/users/customers': {
      get: op('Customers', 'List customers', {
        permission: 'users.view',
        parameters: [...pageParams, qParam('name, email, phone'), query('status', 'Filter by status', enumOf(ACCOUNT_STATUS))],
        response: paginated('Customer'),
      }),
    },
    '/users/customers/{id}': {
      patch: op('Customers', 'Change customer status', {
        permission: 'users.manage',
        parameters: [idParam],
        body: ref('CustomerStatusUpdate'),
        response: ref('Customer'),
        errors: [400, 404],
      }),
    },
    '/users/drivers': {
      get: op('Drivers', 'List riders and drivers', {
        permission: 'users.view',
        description: 'Riders and drivers share one collection; filter with `serviceType`.',
        parameters: [
          ...pageParams,
          qParam('name, email, phone'),
          query('serviceType', 'rider or transport', enumOf(['rider', 'transport'])),
          query('status', 'Account status', enumOf(ACCOUNT_STATUS)),
          query('approvalStatus', 'KYC approval status', enumOf(APPROVAL_STATUS)),
        ],
        response: paginated('Driver'),
      }),
    },
    '/users/drivers/{id}': {
      patch: op('Drivers', 'Approve/reject or change driver status', {
        permission: 'users.manage',
        parameters: [idParam],
        body: ref('ApprovalStatusUpdate'),
        response: ref('Driver'),
        errors: [404],
      }),
    },
    '/users/partners': {
      get: op('Partners', 'List transport partners', {
        permission: 'users.view',
        parameters: [
          ...pageParams,
          qParam('companyName, ownerName, email, phone'),
          query('status', 'Account status', enumOf(ACCOUNT_STATUS)),
          query('approvalStatus', 'KYC approval status', enumOf(APPROVAL_STATUS)),
        ],
        response: paginated('Partner'),
      }),
    },
    '/users/partners/{id}': {
      patch: op('Partners', 'Approve/reject or change partner status', {
        permission: 'users.manage',
        parameters: [idParam],
        body: ref('ApprovalStatusUpdate'),
        response: ref('Partner'),
        errors: [404],
      }),
    },

    // ---------------- Bookings ----------------
    '/bookings': {
      get: op('Bookings', 'List bookings', {
        permission: 'bookings.view',
        parameters: [
          ...pageParams,
          query('mode', 'Service mode', enumOf(SERVICE_MODE)),
          query('status', 'One status, or several comma-separated (e.g. `requested,accepted`)', str()),
          query('paymentStatus', 'Payment status', enumOf(['pending', 'paid', 'failed', 'refunded'])),
          query('q', 'Search by booking code'),
        ],
        response: paginated('Booking'),
      }),
    },
    '/bookings/available-drivers': {
      get: op('Bookings', 'Online, active drivers available for manual assignment', {
        permission: 'bookings.view',
        parameters: [query('mode', 'ride limits to riders and drivers', enumOf(SERVICE_MODE)), query('categoryKey', 'Category key (currently unused by the server)')],
        response: listOf('Driver'),
      }),
    },
    '/bookings/{id}': {
      get: op('Bookings', 'Get a booking with customer, driver, vehicle and partner', {
        permission: 'bookings.view',
        parameters: [idParam],
        response: ref('Booking'),
        errors: [404],
      }),
    },
    '/bookings/{id}/assign': {
      patch: op('Bookings', 'Manually assign a driver (and optionally a vehicle)', {
        permission: 'bookings.manage',
        description: 'A `requested` booking moves to `accepted`.',
        parameters: [idParam],
        body: ref('BookingAssign'),
        response: ref('Booking'),
        errors: [400, 404],
      }),
    },
    '/bookings/{id}/status': {
      patch: op('Bookings', 'Change booking status', {
        permission: 'bookings.manage',
        description: 'Adds a timeline entry. For `cancelled`, also records who cancelled and why.',
        parameters: [idParam],
        body: ref('BookingStatusUpdate'),
        response: ref('Booking'),
        errors: [400, 404],
      }),
    },
    '/service-categories': {
      get: op('Service Categories', 'List service categories', {
        permission: 'bookings.view',
        parameters: [query('mode', 'Service mode', enumOf(SERVICE_MODE))],
        response: listOf('Category'),
      }),
      post: op('Service Categories', 'Create a service category', {
        permission: 'bookings.manage',
        body: ref('CategoryCreate'),
        response: ref('Category'),
        status: 201,
        errors: [400, 409],
      }),
    },
    '/service-categories/{id}': {
      patch: op('Service Categories', 'Update a service category', {
        permission: 'bookings.manage',
        parameters: [idParam],
        body: ref('CategoryUpdate'),
        response: ref('Category'),
        errors: [404],
      }),
      delete: op('Service Categories', 'Delete a service category', { permission: 'bookings.manage', parameters: [idParam], status: 204, errors: [404] }),
    },
    '/sos': {
      get: op('SOS', 'List SOS requests', { permission: 'bookings.view', response: listOf('SosRequest') }),
    },
    '/sos/{id}': {
      patch: op('SOS', 'Update SOS status and/or add a note', {
        permission: 'bookings.manage',
        parameters: [idParam],
        body: ref('SosUpdate'),
        response: ref('SosRequest'),
        errors: [404],
      }),
    },

    // ---------------- Fleet ----------------
    '/fleet/vehicles': {
      get: op('Vehicles', 'List vehicles', {
        permission: 'fleet.view',
        parameters: [
          ...pageParams,
          qParam('registrationNumber, model, manufacturer'),
          query('status', 'Vehicle status', enumOf(['active', 'inactive', 'blocked'])),
          query('serviceMode', 'Service mode', enumOf(SERVICE_MODE)),
          query('ownerType', 'Owner type', enumOf(['driver', 'partner'])),
        ],
        response: paginated('Vehicle'),
      }),
      post: op('Vehicles', 'Register a vehicle', {
        permission: 'fleet.manage',
        description: 'The registration number is stored in upper case and must be unique.',
        body: ref('VehicleCreate'),
        response: ref('Vehicle'),
        status: 201,
        errors: [400, 409],
      }),
    },
    '/fleet/vehicles/{id}': {
      patch: op('Vehicles', 'Update a vehicle', {
        permission: 'fleet.manage',
        parameters: [idParam],
        body: ref('VehicleUpdate'),
        response: ref('Vehicle'),
        errors: [404],
      }),
    },
    '/fleet/vehicle-types': {
      get: op('Vehicle Types', 'List vehicle types', {
        permission: 'fleet.view',
        parameters: [...pageParams, qParam('name'), query('serviceMode', 'Service mode', enumOf(SERVICE_MODE)), query('status', 'Status', enumOf(ACTIVE_INACTIVE))],
        response: paginated('VehicleType'),
      }),
      post: op('Vehicle Types', 'Create a vehicle type', {
        permission: 'fleet.manage',
        body: ref('VehicleTypeCreate'),
        response: ref('VehicleType'),
        status: 201,
        errors: [400],
      }),
    },
    '/fleet/vehicle-types/{id}': {
      patch: op('Vehicle Types', 'Update a vehicle type', {
        permission: 'fleet.manage',
        parameters: [idParam],
        body: ref('VehicleTypeUpdate'),
        response: ref('VehicleType'),
        errors: [404],
      }),
    },
    '/fleet/documents': {
      get: op('Documents', 'List KYC and vehicle documents', {
        permission: 'fleet.view',
        parameters: [...pageParams, query('ownerType', 'Owner type', enumOf(['driver', 'partner', 'vehicle'])), query('status', 'Review status', enumOf(DOC_STATUS))],
        response: paginated('Document'),
      }),
      post: op('Documents', 'Add a document record', {
        permission: 'fleet.manage',
        body: ref('DocumentCreate'),
        response: ref('Document'),
        status: 201,
        errors: [400],
      }),
    },
    '/fleet/documents/{id}': {
      patch: op('Documents', 'Verify, reject or expire a document', {
        permission: 'fleet.manage',
        parameters: [idParam],
        body: ref('DocumentStatusUpdate'),
        response: ref('Document'),
        errors: [400, 404],
      }),
    },

    // ---------------- Pricing & Finance ----------------
    '/pricing': {
      get: op('Pricing', 'List pricing rules', {
        permission: 'pricing.view',
        parameters: [query('mode', 'Service mode', enumOf(SERVICE_MODE)), query('categoryKey', 'Category key'), query('status', 'Status', enumOf(ACTIVE_INACTIVE))],
        response: listOf('PricingRule'),
      }),
      post: op('Pricing', 'Create a pricing rule', {
        permission: 'pricing.manage',
        body: ref('PricingRuleInput'),
        response: ref('PricingRule'),
        status: 201,
        errors: [400],
      }),
    },
    '/pricing/{id}': {
      patch: op('Pricing', 'Update a pricing rule', {
        permission: 'pricing.manage',
        parameters: [idParam],
        body: ref('PricingRuleInput'),
        bodyRequired: false,
        response: ref('PricingRule'),
        errors: [404],
      }),
      delete: op('Pricing', 'Deactivate a pricing rule', {
        permission: 'pricing.manage',
        description: 'Soft delete: sets `status` to `inactive` and returns the rule.',
        parameters: [idParam],
        response: ref('PricingRule'),
        errors: [404],
      }),
    },
    '/commissions': {
      get: op('Commissions', 'List commission rules', {
        permission: 'finance.view',
        parameters: [query('appliesTo', 'Payee type', enumOf(['driver', 'partner'])), query('categoryKey', 'Category key'), query('status', 'Status', enumOf(ACTIVE_INACTIVE))],
        response: listOf('CommissionRule'),
      }),
      post: op('Commissions', 'Create a commission rule', {
        permission: 'finance.manage',
        body: ref('CommissionRuleInput'),
        response: ref('CommissionRule'),
        status: 201,
        errors: [400],
      }),
    },
    '/commissions/{id}': {
      patch: op('Commissions', 'Update a commission rule', {
        permission: 'finance.manage',
        parameters: [idParam],
        body: ref('CommissionRuleInput'),
        bodyRequired: false,
        response: ref('CommissionRule'),
        errors: [404],
      }),
      delete: op('Commissions', 'Deactivate a commission rule', {
        permission: 'finance.manage',
        description: 'Soft delete: sets `status` to `inactive` and returns the rule.',
        parameters: [idParam],
        response: ref('CommissionRule'),
        errors: [404],
      }),
    },
    '/payments': {
      get: op('Payments', 'List payments', {
        permission: 'finance.view',
        parameters: [
          ...pageParams,
          query('status', 'Payment status', enumOf(['initiated', 'success', 'failed', 'refunded'])),
          query('method', 'Payment method', enumOf(['cash', 'upi', 'card', 'netbanking', 'wallet'])),
          query('q', 'Search by booking code'),
        ],
        response: paginatedPageSize('Payment'),
      }),
    },
    '/refunds': {
      get: op('Refunds', 'List refunds', {
        permission: 'finance.view',
        parameters: [...pageParams, query('status', 'Refund status', enumOf(['requested', 'approved', 'rejected', 'processed']))],
        response: paginatedPageSize('Refund'),
      }),
    },
    '/refunds/{id}/approve': {
      patch: op('Refunds', 'Approve a requested refund', {
        permission: 'finance.manage',
        parameters: [idParam],
        response: ref('Refund'),
        errors: [400, 404],
      }),
    },
    '/refunds/{id}/reject': {
      patch: op('Refunds', 'Reject a requested refund', {
        permission: 'finance.manage',
        parameters: [idParam],
        body: obj({ reason: str() }),
        bodyRequired: false,
        response: ref('Refund'),
        errors: [400, 404],
      }),
    },
    '/refunds/{id}/process': {
      patch: op('Refunds', 'Process an approved refund', {
        permission: 'finance.manage',
        description: "Credits the refund amount to the customer's wallet (created if missing) and records a wallet transaction.",
        parameters: [idParam],
        response: ref('Refund'),
        errors: [400, 404],
      }),
    },
    '/wallets': {
      get: op('Wallets', 'List wallets', {
        permission: 'finance.view',
        parameters: [...pageParams, query('ownerType', 'Owner type', enumOf(['customer', 'driver', 'partner']))],
        response: paginatedPageSize('Wallet'),
      }),
    },
    '/wallets/{id}/transactions': {
      get: op('Wallets', 'List transactions for a wallet', {
        permission: 'finance.view',
        parameters: [idParam],
        response: listOf('WalletTransaction'),
        errors: [404],
      }),
    },
    '/wallets/{id}/adjust': {
      post: op('Wallets', 'Manually credit or debit a wallet', {
        permission: 'finance.manage',
        parameters: [idParam],
        body: ref('WalletAdjust'),
        response: obj({ wallet: ref('Wallet'), transaction: ref('WalletTransaction') }),
        errors: [400, 404],
      }),
    },
    '/settlements': {
      get: op('Settlements', 'List driver and partner settlements', {
        permission: 'finance.view',
        parameters: [...pageParams, query('payeeType', 'Payee type', enumOf(['driver', 'partner'])), query('status', 'Status', enumOf(['pending', 'processing', 'paid']))],
        response: paginatedPageSize('Settlement'),
      }),
    },
    '/settlements/{id}/mark-paid': {
      patch: op('Settlements', 'Mark a settlement as paid', {
        permission: 'finance.manage',
        parameters: [idParam],
        response: ref('Settlement'),
        errors: [400, 404],
      }),
    },

    // ---------------- Marketing ----------------
    '/coupons': {
      get: op('Coupons', 'List coupons and offers', {
        permission: 'marketing.view',
        parameters: [
          query('autoApply', 'true = offers, false = coupon codes', enumOf(['true', 'false'])),
          query('status', 'Status', enumOf(ACTIVE_INACTIVE)),
          qParam('title, code'),
        ],
        response: listOf('Coupon'),
      }),
      post: op('Coupons', 'Create a coupon or offer', {
        permission: 'marketing.manage',
        body: ref('CouponInput'),
        response: ref('Coupon'),
        status: 201,
        errors: [400],
      }),
    },
    '/coupons/{id}': {
      get: op('Coupons', 'Get a coupon', { permission: 'marketing.view', parameters: [idParam], response: ref('Coupon'), errors: [404] }),
      patch: op('Coupons', 'Update a coupon', {
        permission: 'marketing.manage',
        parameters: [idParam],
        body: ref('CouponInput'),
        bodyRequired: false,
        response: ref('Coupon'),
        errors: [404],
      }),
      delete: op('Coupons', 'Delete a coupon', { permission: 'marketing.manage', parameters: [idParam], status: 204, errors: [404] }),
    },
    '/banners': {
      get: op('Banners', 'List banners', {
        permission: 'marketing.view',
        parameters: [query('status', 'Status', enumOf(ACTIVE_INACTIVE)), query('serviceMode', 'Service mode', enumOf(SERVICE_MODE_BOTH))],
        response: listOf('Banner'),
      }),
      post: op('Banners', 'Create a banner', {
        permission: 'marketing.manage',
        body: ref('BannerInput'),
        response: ref('Banner'),
        status: 201,
        errors: [400],
      }),
    },
    '/banners/{id}': {
      get: op('Banners', 'Get a banner', { permission: 'marketing.view', parameters: [idParam], response: ref('Banner'), errors: [404] }),
      patch: op('Banners', 'Update a banner', {
        permission: 'marketing.manage',
        parameters: [idParam],
        body: ref('BannerInput'),
        bodyRequired: false,
        response: ref('Banner'),
        errors: [404],
      }),
      delete: op('Banners', 'Delete a banner', { permission: 'marketing.manage', parameters: [idParam], status: 204, errors: [404] }),
    },
    '/notifications/templates': {
      get: op('Notifications', 'List notification templates', { permission: 'marketing.view', response: listOf('NotificationTemplate') }),
      post: op('Notifications', 'Create a notification template', {
        permission: 'marketing.manage',
        body: ref('NotificationTemplateInput'),
        response: ref('NotificationTemplate'),
        status: 201,
        errors: [400],
      }),
    },
    '/notifications/templates/{id}': {
      patch: op('Notifications', 'Update a notification template', {
        permission: 'marketing.manage',
        parameters: [idParam],
        body: ref('NotificationTemplateInput'),
        bodyRequired: false,
        response: ref('NotificationTemplate'),
        errors: [404],
      }),
    },
    '/notifications/broadcasts': {
      get: op('Notifications', 'List sent broadcasts', { permission: 'marketing.view', response: listOf('NotificationBroadcast') }),
      post: op('Notifications', 'Send a broadcast', {
        permission: 'marketing.manage',
        description: 'Nothing is actually delivered yet; the server records the broadcast with an estimated recipient count.',
        body: ref('NotificationBroadcastInput'),
        response: ref('NotificationBroadcast'),
        status: 201,
        errors: [400],
      }),
    },
    '/cms': {
      get: op('CMS', 'List all CMS pages', {
        permission: 'marketing.view',
        description: 'Missing pages are created empty on first read.',
        response: listOf('CmsPage'),
      }),
    },
    '/cms/{slug}': {
      get: op('CMS', 'Get a CMS page', {
        permission: 'marketing.view',
        parameters: [pathParam('slug', 'Page slug', enumOf(CMS_SLUGS))],
        response: ref('CmsPage'),
        errors: [404],
      }),
      patch: op('CMS', 'Update a CMS page', {
        permission: 'marketing.manage',
        parameters: [pathParam('slug', 'Page slug', enumOf(CMS_SLUGS))],
        body: ref('CmsPageUpdate'),
        response: ref('CmsPage'),
        errors: [404],
      }),
    },

    // ---------------- Service areas ----------------
    '/service-areas': {
      get: op('Service Areas', 'List service areas', {
        permission: 'settings.view',
        parameters: [query('status', 'Status', enumOf(ACTIVE_INACTIVE)), qParam('name, city, state')],
        response: listOf('ServiceArea'),
      }),
      post: op('Service Areas', 'Create a service area', {
        permission: 'settings.manage',
        body: ref('ServiceAreaInput'),
        response: ref('ServiceArea'),
        status: 201,
        errors: [400],
      }),
    },
    '/service-areas/{id}': {
      get: op('Service Areas', 'Get a service area', { permission: 'settings.view', parameters: [idParam], response: ref('ServiceArea'), errors: [404] }),
      patch: op('Service Areas', 'Update a service area', {
        permission: 'settings.manage',
        parameters: [idParam],
        body: ref('ServiceAreaInput'),
        bodyRequired: false,
        response: ref('ServiceArea'),
        errors: [404],
      }),
      delete: op('Service Areas', 'Delete a service area', { permission: 'settings.manage', parameters: [idParam], status: 204, errors: [404] }),
    },

    // ---------------- Support ----------------
    '/tickets': {
      get: op('Tickets', 'List support tickets', {
        permission: 'support.view',
        parameters: [
          query('category', 'Category', enumOf(['payment', 'booking', 'driver', 'vehicle', 'lost_item', 'refund', 'cancellation', 'technical'])),
          query('status', 'Status', enumOf(['open', 'assigned', 'in_progress', 'resolved', 'closed'])),
          query('priority', 'Priority', enumOf(['low', 'medium', 'high'])),
          qParam('subject, raisedByName'),
        ],
        response: listOf('Ticket'),
      }),
    },
    '/tickets/{id}': {
      get: op('Tickets', 'Get a ticket', { permission: 'support.view', parameters: [idParam], response: ref('Ticket'), errors: [404] }),
      patch: op('Tickets', 'Update status, priority, assignee or add a note', {
        permission: 'support.manage',
        description: 'Assigning an `open` ticket moves it to `assigned`.',
        parameters: [idParam],
        body: ref('TicketUpdate'),
        response: ref('Ticket'),
        errors: [404],
      }),
    },
    '/ratings': {
      get: op('Ratings', 'List ratings and reviews', {
        permission: 'support.view',
        parameters: [query('ratedBy', 'Who gave the rating', enumOf(['customer', 'driver'])), query('minScore', 'Minimum score', num({ minimum: 1, maximum: 5 }))],
        response: listOf('Rating'),
      }),
    },

    // ---------------- Reports ----------------
    '/reports/booking': {
      get: op('Reports', 'Booking report', {
        permission: 'reports.view',
        description: 'Up to 1000 rows, newest first.',
        parameters: [...reportRange, query('mode', 'Service mode', enumOf(SERVICE_MODE)), query('status', 'Booking status', enumOf(BOOKING_STATUS))],
        response: ref('BookingReport'),
      }),
    },
    '/reports/revenue': {
      get: op('Reports', 'Revenue report (completed bookings)', { permission: 'reports.view', parameters: reportRange, response: ref('RevenueReport') }),
    },
    '/reports/rider': {
      get: op('Reports', 'Rider and driver performance report', { permission: 'reports.view', parameters: reportRange, response: ref('RiderReport') }),
    },
    '/reports/partner': {
      get: op('Reports', 'Transport partner report', { permission: 'reports.view', parameters: reportRange, response: ref('PartnerReport') }),
    },
    '/reports/financial': {
      get: op('Reports', 'Financial report (payments, refunds, wallets)', { permission: 'reports.view', parameters: reportRange, response: ref('FinancialReport') }),
    },
  }),
  },
}
