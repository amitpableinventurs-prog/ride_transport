# AnZ Cabs API documentation

Base URL: `http://localhost:5050`. Live Swagger: `http://localhost:5050/api-docs`. Raw OpenAPI JSON: `/api-docs.json`.

## 1. Which APIs are for purchase / payment

AnZ Cabs has no product purchase. Money moves in four ways, and these are the APIs for each.

### Customer app

| Purpose | API | Notes |
|---|---|---|
| **Buy wallet credit** (add money) | `POST /api/v1/customer/wallet/topup` then `POST /api/v1/customer/payments/verify` | Amount ₹10 to ₹10,000 |
| **Pay for a trip online** | `POST /api/v1/customer/payments/order` then `POST /api/v1/customer/payments/verify` | Only after the trip is `completed` and `paymentStatus` is `pending` |
| Pay for a trip from wallet | Set `"paymentMethod": "wallet"` on `POST /api/v1/customer/bookings` | Needs enough balance, else 402. Charged when the trip completes |
| Pay cash | `"paymentMethod": "cash"` on `POST /api/v1/customer/bookings` | Rider collects it. No payment API call |
| See balance and history | `GET /api/v1/customer/wallet` | Negative balance means unpaid cancellation charges |
| Coupons before paying | `POST /api/v1/customer/coupons/validate`, `GET /api/v1/customer/offers` | Coupon goes in `couponCode` on the booking |

### Rider app
| Purpose | API |
|---|---|
| Wallet, dues and transactions | `GET /api/v1/rider/wallet` |
| Pay commission dues online | `POST /api/v1/rider/wallet/pay-dues` then `POST /api/v1/rider/payments/verify` |
| Withdraw earnings | `POST /api/v1/rider/withdrawals` (request payout to bank or UPI), `GET /api/v1/rider/withdrawals` (history) |

### Admin panel
| Purpose | API |
|---|---|
| All payments | `GET /api/v1/admin/payments` |
| Wallets and their transactions | `GET /api/v1/admin/wallets`, `GET /api/v1/admin/wallets/{id}/transactions` |
| Manual credit or debit | `POST /api/v1/admin/wallets/{id}/adjust` |
| Refunds | Refunds tag in section 3 |
| Rider settlements | Settlements tag in section 3 |
| Financial report | `GET /api/v1/admin/reports/financial` |

### Online payment flow (wallet top-up and trip payment)

1. App calls `POST /customer/wallet/topup` with `{ "amount": 500 }`, or `POST /customer/payments/order` with `{ "bookingId": "..." }`.
2. Server returns `{ orderId, amount, currency, purpose, provider, key }`. `purpose` is `wallet_topup` or `booking`.
3. App opens the gateway checkout (Razorpay SDK) with `orderId` and `key`.
4. On success the gateway gives `paymentId` and `signature`. App calls `POST /customer/payments/verify` with `{ orderId, paymentId, signature }`.
5. Server checks the signature and applies the payment once. A trip is marked paid, or the wallet is credited. Repeating the call is safe and returns `alreadyProcessed: true`.

Verify response for a top-up: `{ "status": "paid", "purpose": "wallet_topup", "amount": 500, "walletBalance": 500 }`. For a trip: `{ "status": "paid", "purpose": "booking", "amount": 180, "bookingId": "..." }`.

**Provider setting** (`server/.env`): `PAYMENT_PROVIDER=mock` (default, development) or `razorpay` (with `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`). With `mock`, send `"signature": "mock_success"` to verify any order. The mock provider is refused in production (503). Real Razorpay is not tested here.

Errors: 400 invalid amount or signature, 404 order or booking not found, 409 trip not completed or already paid, 402 not enough wallet balance, 503 payments not configured.

## 2. Authentication

| Who | How | Token used on |
|---|---|---|
| Customer app (Flutter) | `POST /api/v1/app/auth/otp/send`, `/app/auth/otp/resend`, `/app/auth/otp/verify`, `/app/auth/register`, `/app/auth/refresh`, `/app/auth/me`, `/app/auth/logout`. Body: `phone` plus `userType` (`customer`; `driver` and `partner` also work) | `/customer/*`, `/app/profile`, `/common/*` |
| Rider app (own login, no role needed) | `POST /api/v1/rider/auth/otp/send`, `/rider/auth/otp/resend`, `/rider/auth/otp/verify`, `/rider/auth/refresh`, `/rider/auth/logout`, `/rider/auth/me`. Body: `phone` (and `otp`) | `/rider/*` |
| Admin panel | `POST /api/v1/admin/auth/login` (email and password), then `POST /api/v1/admin/auth/login/verify-otp` | `/admin/*` |

Send `Authorization: Bearer <accessToken>`. Access tokens are short-lived: use the refresh endpoint of the same login (single-use refresh tokens). In development, the OTP is returned as `devOtp` in the send response.

Paths in section 3 are relative to `/api/v1` and are listed under the same tags as Swagger. Customer and rider tags use the app token, admin tags use the admin token.

## 3. Full reference



## Customer

#### `GET /customer/profile` — Get profile

Auth: Bearer token

Responses: 200, 401

#### `PATCH /customer/profile` — Update name, email, photo, language

JSON or multipart. Fields: `name`, `email`, `gender`, `dateOfBirth`, `emergencyContact`, `city`, plus `language` and `photoUrl`; upload a new photo as multipart `photo`.

Auth: Bearer token

Body:
- `name` (string)
- `email` (string)
- `language` (enum(en|hi|mr|gu|bn|ta|te|kn|ml|pa|or))
- `photo` (string): JPEG/PNG/WebP up to 5 MB
- `emergencyContact` (string): JSON string in multipart

Responses: 200, 400, 401

#### `GET /customer/home` — Home screen summary

Name and initial for the greeting, serviceability and enabled modes at `lat`/`lng` (both optional), any open booking, saved places and the latest recent places.

Auth: Bearer token

Parameters:
- `lat` (query): Latitude
- `lng` (query): Longitude

Responses: 200, 401

#### `GET /customer/all-services` — All Services screen in one call

Two sections (Ride, Transport), each with `title`, `subtitle` and `items` (key, name, icon, seats or capacityLabel). `lat`/`lng` are optional: without them every active category is listed; with them `serviceable`, the `available` flag, `ridersNearby` and `etaMin` are filled. Categories are managed in the admin panel (Operations → Categories).

Auth: Bearer token

Parameters:
- `lat` (query): Latitude
- `lng` (query): Longitude

Responses: 200, 401

#### `GET /customer/recent-places` — Recent destinations

Distinct drop-offs from past bookings, newest first. `favouriteId` is set when the place is saved (filled heart): tap to un-favourite with `DELETE /saved-places/{id}`, otherwise favourite it with `POST /saved-places` (label `other`).

Auth: Bearer token

Parameters:
- `limit` (query): Default 6, max 20

Responses: 200, 401

#### `GET /customer/places/search` — Search saved and recent places

Pickup/drop search box. Matches the customer's own places only; use the map SDK for city-wide search.

Auth: Bearer token

Parameters:
- `q` (query): Text to match in name or address (required)
- `lat` (query): Latitude for `distanceKm`
- `lng` (query): Longitude for `distanceKm`

Responses: 200, 400, 401

#### `GET /customer/places/reverse` — Address under the pickup pin

Known address within 200 m (saved or recent), else `address: null` with the service-area `city`. A geocoding provider is not wired in yet.

Auth: Bearer token

Parameters:
- `lat` (query): Latitude
- `lng` (query): Longitude

Responses: 200, 400, 401

#### `GET /customer/referral` — Refer & Earn screen

Own referral code (created on first call), share text, reward amounts, how-it-works steps, stats and the list of invited friends.

Auth: Bearer token

Responses: 200, 401

#### `POST /customer/referral/apply` — Apply a friend's referral code

Once per customer, before their first completed ride. When that ride completes, both wallets get a `referral` credit (amounts in platform settings).

Auth: Bearer token

Body:
- `code` (string, required) e.g. `"RIDE6655"`

Responses: 200, 400, 401, 404, 409, 422

#### `GET /customer/saved-places` — Saved places

Auth: Bearer token

Responses: 200, 401

#### `POST /customer/saved-places` — Add a saved place

`home` and `work` are unique: saving one replaces the previous. `other` needs a `name`. Up to 10 places.

Auth: Bearer token

Body:
- `label` (enum(home|work|other), required)
- `name` (string) e.g. `"Gym"`
- `address` (string, required)
- `lat` (number, required)
- `lng` (number, required)

Responses: 201, 400, 401

#### `DELETE /customer/saved-places/{id}` — Delete a saved place

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 204, 401, 404

#### `GET /customer/emergency-contacts` — SOS contacts

Auth: Bearer token

Responses: 200, 401

#### `PUT /customer/emergency-contacts` — Replace SOS contacts (1-3)

The first contact is also the Profile screen emergency contact.

Auth: Bearer token

Body:
- `contacts` (object[], required)
  - `name` (string, required)
  - `phone` (string, required)

Responses: 200, 400, 401

#### `GET /customer/services` — Ride + Transport categories at a location

Per category: `ridersNearby` and `etaMin` of the nearest online rider. `serviceable: false` outside every service area.

Auth: Bearer token

Parameters:
- `lat` (query): Latitude
- `lng` (query): Longitude

Responses: 200, 400, 401

#### `POST /customer/fare-estimate` — Fare per category for pickup, drops and goods

Rides have one drop; transport up to 5. Optional `mode`, `categoryKey`, `couponCode`, `scheduledAt`. Distance is estimated (straight line × 1.3) until a maps provider is added.

Auth: Bearer token

Body:
- `pickup` (object, required)
  - `lat` (number, required) e.g. `19.076`
  - `lng` (number, required) e.g. `72.8777`
  - `address` (string) e.g. `"Dadar, Mumbai"`
- `drops` (object[])
  - `lat` (number, required) e.g. `19.1`
  - `lng` (number, required) e.g. `72.89`
  - `address` (string) e.g. `"Kurla, Mumbai"`
  - `contactName` (string): Transport: receiver name
  - `contactPhone` (string): Transport: receiver mobile
- `drop` (object): Shorthand for a single drop (rides)
  - `lat` (number, required) e.g. `19.076`
  - `lng` (number, required) e.g. `72.8777`
  - `address` (string) e.g. `"Dadar, Mumbai"`
- `goods` (object)
  - `description` (string) e.g. `"Documents"`
  - `weightKg` (number)
  - `notes` (string)
  - `needsLoading` (boolean)
- `mode` (enum(ride|transport))
- `categoryKey` (string)
- `couponCode` (string)
- `scheduledAt` (string)

Responses: 200, 400, 401, 422

#### `POST /customer/coupons/validate` — Check a coupon against an estimate

Always `200`; `valid: false` carries the reason.

Auth: Bearer token

Body:
- `code` (string, required) e.g. `"WELCOME50"`
- `categoryKey` (string, required)
- `fareTotal` (number, required)
- `pickup` (object)
  - `lat` (number, required) e.g. `19.076`
  - `lng` (number, required) e.g. `72.8777`
  - `address` (string) e.g. `"Dadar, Mumbai"`

Responses: 200, 401

#### `POST /customer/bookings` — Create a Ride or Transport booking (now or scheduled)

Needs a complete profile. Starts matching immediately (status `requested`) unless `scheduledAt` (30 min to 7 days ahead) is set.

The response has `startOtp` (and a per-stop `otp` for transport) for the customer to share; riders never see them.

`409` if another booking is ongoing. `402` for wallet payment without enough balance.

Auth: Bearer token

Body:
- `pickup` (object, required)
  - `lat` (number, required) e.g. `19.076`
  - `lng` (number, required) e.g. `72.8777`
  - `address` (string) e.g. `"Dadar, Mumbai"`
- `drops` (object[])
  - `lat` (number, required) e.g. `19.1`
  - `lng` (number, required) e.g. `72.89`
  - `address` (string) e.g. `"Kurla, Mumbai"`
  - `contactName` (string): Transport: receiver name
  - `contactPhone` (string): Transport: receiver mobile
- `drop` (object): Shorthand for a single drop (rides)
  - `lat` (number, required) e.g. `19.076`
  - `lng` (number, required) e.g. `72.8777`
  - `address` (string) e.g. `"Dadar, Mumbai"`
- `goods` (object)
  - `description` (string) e.g. `"Documents"`
  - `weightKg` (number)
  - `notes` (string)
  - `needsLoading` (boolean)
- `categoryKey` (string, required) e.g. `"bike"`
- `mode` (enum(ride|transport))
- `paymentMethod` (enum(cash|wallet|upi|card|netbanking))
- `couponCode` (string)
- `scheduledAt` (string)

Responses: 201, 400, 401, 402, 403, 409, 422

#### `GET /customer/bookings` — Booking history

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `mode` (query): ride or transport
- `status` (query): Comma-separated statuses
- `from` (query): Start date (ISO). Defaults to 30 days ago.
- `to` (query): End date (ISO). A date-only value includes the whole day. Defaults to now.

Responses: 200, 401

#### `GET /customer/bookings/{id}` — Booking detail: rider, timeline, fare

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Responses: 200, 401, 404

#### `GET /customer/bookings/{id}/track` — Rider live location + ETA (fallback to socket)

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Responses: 200, 401, 404

#### `PATCH /customer/bookings/{id}/drop` — Change the drop during the trip

Re-prices the trip and emits `booking:fare_updated` to customer and rider.

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Body:
- `drop` (object, required)
  - `lat` (number, required) e.g. `19.076`
  - `lng` (number, required) e.g. `72.8777`
  - `address` (string) e.g. `"Dadar, Mumbai"`

Responses: 200, 400, 401, 404, 409, 422

#### `POST /customer/bookings/{id}/cancel` — Cancel with reason; returns the charge applied

Free while searching and for `freeCancellationMinutes` (default 2) after a rider accepts. After that, or once the rider has arrived, the category cancellation fee is charged to the wallet and paid to the rider.

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Body:
- `reason` (string)

Responses: 200, 401, 404, 409

#### `POST /customer/bookings/{id}/retry` — Retry the search after "no rider found"

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Responses: 200, 401, 404, 409

#### `POST /customer/bookings/{id}/rating` — Rate the rider and tip

The tip (₹1-500) is paid from the wallet to the rider.

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Body:
- `score` (integer, required)
- `comment` (string)
- `tip` (number)

Responses: 201, 400, 401, 402, 404, 409

#### `GET /customer/bookings/{id}/invoice` — Invoice PDF link (valid 7 days)

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Responses: 200, 401, 404, 409

#### `POST /customer/bookings/{id}/share` — Create a public tracking link

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Responses: 200, 401, 404, 409

#### `POST /customer/bookings/{id}/call` — Number to call the rider

Masked calling is not integrated yet: with TELEPHONY_PROVIDER=direct (development) this returns the real number with `masked: false`; production returns `503` until a provider is added.

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Responses: 200, 401, 404, 409, 503

#### `GET /customer/wallet` — Balance + transactions

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)

Responses: 200, 401

#### `POST /customer/wallet/topup` — Gateway order to add money (₹10-10,000)

Auth: Bearer token

Body:
- `amount` (number, required) e.g. `500`

Responses: 201, 400, 401, 503

#### `POST /customer/payments/order` — Gateway order for a completed, unpaid booking

Auth: Bearer token

Body:
- `bookingId` (string, required) e.g. `"665f1c2e9b1e8a0012345678"`

Responses: 201, 401, 404, 409, 503

#### `POST /customer/payments/verify` — Verify the gateway signature after payment

Applies the payment once (booking marked paid, or wallet credited).

Auth: Bearer token

Body:
- `orderId` (string, required)
- `paymentId` (string, required) e.g. `"pay_29QQoUBi66xm2f"`
- `signature` (string, required): Gateway signature. With PAYMENT_PROVIDER=mock (development) send `mock_success`.

Responses: 200, 400, 401, 404

#### `GET /customer/offers` — Active coupons and banners

Auth: Bearer token

Responses: 200, 401

#### `POST /customer/sos` — Raise SOS

Alerts admins live (`sos:alert` on the /admin socket) and SMSes the emergency contacts a map link.

Auth: Bearer token

Body:
- `lat` (number, required)
- `lng` (number, required)
- `bookingId` (string): Optional; must be your booking e.g. `"665f1c2e9b1e8a0012345678"`
- `note` (string)

Responses: 201, 400, 401, 404

#### `GET /customer/tickets` — My support tickets

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)

Responses: 200, 401

#### `POST /customer/tickets` — Raise a support ticket

Auth: Bearer token

Body:
- `subject` (string, required)
- `category` (enum(payment|booking|driver|vehicle|lost_item|refund|cancellation|technical), required)
- `description` (string)
- `bookingId` (string) e.g. `"665f1c2e9b1e8a0012345678"`

Responses: 201, 400, 401, 404

#### `GET /customer/notifications` — Notification inbox

Personal notifications (marked read when returned) plus `announcements`: admin push broadcasts from the last 30 days.

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)

Responses: 200, 401

#### `DELETE /customer/account` — Request account deletion

Auth: Bearer token

Body:
- `reason` (string)

Responses: 200, 401, 409


## Rider

#### `POST /rider/auth/otp/send` — Rider login: send OTP

Rider-only login. The account type is always a rider, so only the phone is sent (no `role`).

Auth: Public (no token)

Body:
- `phone` (string, required) e.g. `"9876543210"`

Responses: 200, 400, 403, 429

#### `POST /rider/auth/otp/resend` — Rider login: resend OTP

Auth: Public (no token)

Body:
- `phone` (string, required) e.g. `"9876543210"`

Responses: 200, 400, 403, 429

#### `POST /rider/auth/otp/verify` — Rider login: verify OTP, returns tokens

A new number gets a rider account immediately (`201`, `isNewUser: true`) with `approvalStatus: pending`; continue with the onboarding screens.

Auth: Public (no token)

Body:
- `phone` (string, required)
- `otp` (string, required)

Responses: 200, 400, 403, 429

#### `POST /rider/auth/refresh` — Rider login: new token pair from a refresh token

Auth: Public (no token)

Body:
- `refreshToken` (string, required)

Responses: 200, 401

#### `POST /rider/auth/logout` — Rider logout: revoke the refresh token and remove the FCM token

Auth: Bearer token

Body:
- `refreshToken` (string)
- `fcmToken` (string)

Responses: 204, 401

#### `GET /rider/auth/me` — Logged-in rider (same as GET /profile)

Auth: Bearer token

Responses: 200, 401

#### `GET /rider/profile` — Get profile

Auth: Bearer token

Responses: 200, 401

#### `PATCH /rider/profile` — Update profile

Same fields as the customer profile.

Auth: Bearer token

Body (multipart):
- `name` (string)
- `photo` (string): JPEG/PNG/WebP up to 5 MB

Responses: 200, 400, 401

#### `GET /rider/onboarding/options` — Licence choices, vehicle types, services and document types for onboarding

Auth: Bearer token

Responses: 200, 401

#### `PUT /rider/onboarding/license` — Do you have a driving licence? (Yes / No)

"Yes" = bike taxi + delivery orders. "No" = delivery (transport) orders only, and the licence upload is skipped. Returns the services allowed for the choice.

Auth: Bearer token

Body:
- `hasLicense` (boolean, required)

Responses: 200, 400, 401, 409

#### `POST /rider/onboarding` — Choose type (individual / partner code), vehicle type, services

Ride services are refused when the rider chose "No licence".

Auth: Bearer token

Body:
- `type` (enum(individual|partner), required)
- `partnerCode` (string) e.g. `"P1A2B3C"`
- `vehicleTypeId` (string, required) e.g. `"665f1c2e9b1e8a0012345678"`
- `services` (string[], required)
- `serviceType` (enum(rider|transport))
- `hasLicense` (boolean): Optional; defaults to the answer saved by PUT /onboarding/license

Responses: 200, 400, 401, 409

#### `GET /rider/onboarding/status` — Documents under verification checklist

One row per step: vehicle (selected), driving_license (hidden without a licence), photo_name, vehicle_number, identity (Aadhaar or PAN). Item status: not_submitted, selected, under_review, verified or rejected (with a reason). `status` is pending, under_review, approved or rejected; `nextStep` is the first item to fix.

Auth: Bearer token

Responses: 200, 401

#### `POST /rider/documents` — Upload a document (front, back, number)

Re-uploading a type replaces it and sends it back for review. Needed for approval: driving_license (front + back, unless the rider has no licence) and one of aadhaar / pan. Number formats: driving licence like KA12345677899029, Aadhaar 12 digits, PAN like ABCDE1234F. vehicle_rc is uploaded with the vehicle (POST /vehicle) or here.

Auth: Bearer token

Body (multipart):
- `file` (string, required): Front side. JPEG/PNG/WebP/PDF up to 5 MB
- `backFile` (string): Back side. Required for driving_license; optional for vehicle_rc and aadhaar
- `docType` (enum(driving_license|vehicle_rc|vehicle_insurance|aadhaar|pan|pollution_certificate|permit|police_verification), required)
- `docNumber` (string, required)
- `expiryDate` (string): Required for insurance, PUC and permit

Responses: 201, 400, 401, 409

#### `GET /rider/documents` — Documents with verification status

Auth: Bearer token

Responses: 200, 401

#### `GET /rider/vehicle` — Current vehicle + pending change requests

Auth: Bearer token

Responses: 200, 401

#### `POST /rider/vehicle` — Vehicle number screen: register or correct the vehicle

JSON or multipart. After onboarding only `registrationNumber` is needed; vehicle type and category come from the onboarding choice. Optional RC photos (`rcFront`, `rcBack`) are saved as the vehicle_rc document. Before approval, sending it again corrects the pending request (200); after approval it files a change request (201). Created inactive; goes live when an admin activates it.

Auth: Bearer token

Body (multipart):
- `registrationNumber` (string, required) e.g. `"MH12AB1234"`
- `vehicleTypeId` (string): Optional: defaults to the onboarding vehicle type e.g. `"665f1c2e9b1e8a0012345678"`
- `categoryKey` (string): Optional: defaults to the chosen service for this vehicle type
- `model` (string): Optional: defaults to the vehicle type name
- `manufacturer` (string)
- `rcFront` (string): RC front side (optional)
- `rcBack` (string): RC back side (optional)

Responses: 201, 400, 401, 409

#### `GET /rider/approval-status` — pending, under_review, approved or rejected + reasons

Auth: Bearer token

Responses: 200, 401

#### `POST /rider/duty/online` — Go online

`403` not approved · `428` selfie due (`selfieRequired: true`) · `402` cash dues above `maxCashDues` · `409` no active vehicle.

Auth: Bearer token

Body:
- `lat` (number, required)
- `lng` (number, required)

Responses: 200, 400, 401, 402, 403, 409, 428

#### `POST /rider/duty/offline` — Go offline

Auth: Bearer token

Responses: 200, 401, 409

#### `POST /rider/selfie-check` — Upload a selfie

No face-match provider is integrated yet: the selfie is stored for admin review and the check passes (`faceMatch: "not_configured"`).

Auth: Bearer token

Body (multipart):
- `selfie` (string, required): JPEG/PNG/WebP

Responses: 200, 400, 401

#### `GET /rider/requests/current` — Pending request offered to this rider

Auth: Bearer token

Responses: 200, 401

#### `POST /rider/requests/{bookingId}/accept` — Accept a request (409 if taken or expired)

Auth: Bearer token

Parameters:
- `bookingId` (path, required): Booking id

Responses: 200, 401, 409

#### `POST /rider/requests/{bookingId}/reject` — Reject a request

Auth: Bearer token

Parameters:
- `bookingId` (path, required): Booking id

Responses: 204, 401, 409

#### `GET /rider/bookings/active` — Current trip

Auth: Bearer token

Responses: 200, 401

#### `GET /rider/bookings` — Trip history

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `status` (query): Comma-separated statuses
- `from` (query): Start date (ISO). Defaults to 30 days ago.
- `to` (query): End date (ISO). A date-only value includes the whole day. Defaults to now.

Responses: 200, 401

#### `POST /rider/bookings/{id}/arrived` — Mark arrived at pickup

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Responses: 200, 401, 404, 409

#### `POST /rider/bookings/{id}/start` — Verify start/pickup OTP (+ goods photo)

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Body (multipart):
- `otp` (string, required) e.g. `"4821"`
- `goodsPhoto` (string): Required for transport

Responses: 200, 400, 401, 404, 409

#### `POST /rider/bookings/{id}/stops/{stopId}/complete` — Complete a transport drop with OTP + POD

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id
- `stopId` (path, required): Stop id

Body (multipart):
- `otp` (string, required)
- `pod` (string, required): Proof-of-delivery photo

Responses: 200, 400, 401, 404, 409

#### `POST /rider/bookings/{id}/complete` — End trip; returns the final fare

Adds waiting charges beyond `freeWaitingMinutes`. Wallet bookings are charged now; `collectCash` is the amount to collect for cash bookings.

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Responses: 200, 401, 404, 409

#### `POST /rider/bookings/{id}/cash-collected` — Confirm cash received

Marks the booking paid; the platform commission is added to the rider wallet as dues.

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Responses: 200, 401, 404, 409

#### `POST /rider/bookings/{id}/cancel` — Cancel with reason

Allowed before the trip starts; the booking goes back to searching for another rider.

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Body:
- `reason` (string, required)

Responses: 204, 400, 401, 409

#### `POST /rider/bookings/{id}/rating` — Rate the customer

Auth: Bearer token

Parameters:
- `id` (path, required): Booking id

Body:
- `score` (integer, required)
- `comment` (string)

Responses: 201, 400, 401, 404, 409

#### `GET /rider/earnings` — Earnings summary and per-trip breakdown

Defaults to the last 7 days.

Auth: Bearer token

Parameters:
- `from` (query): Start date (ISO). Defaults to 30 days ago.
- `to` (query): End date (ISO). A date-only value includes the whole day. Defaults to now.

Responses: 200, 401

#### `GET /rider/wallet` — Balance, dues, transactions

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)

Responses: 200, 401

#### `POST /rider/wallet/pay-dues` — Gateway order to clear dues

Auth: Bearer token

Body:
- `amount` (number): Defaults to all dues

Responses: 201, 400, 401, 409, 503

#### `POST /rider/payments/verify` — Verify a dues payment

Auth: Bearer token

Body:
- `orderId` (string, required)
- `paymentId` (string, required) e.g. `"pay_29QQoUBi66xm2f"`
- `signature` (string, required): Gateway signature. With PAYMENT_PROVIDER=mock (development) send `mock_success`.

Responses: 200, 400, 401, 404

#### `POST /rider/withdrawals` — Request a payout to bank/UPI

Minimum `minWithdrawalAmount` (default ₹100). The amount is held from the wallet; one payout in progress at a time.

Auth: Bearer token

Body:
- `amount` (number, required)
- `method` (enum(bank|upi), required)
- `upiId` (string) e.g. `"name@okaxis"`
- `bankAccount` (object)
  - `holderName` (string)
  - `accountNumber` (string)
  - `ifsc` (string) e.g. `"HDFC0001234"`

Responses: 201, 400, 401, 402, 409

#### `GET /rider/withdrawals` — Payout history

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)

Responses: 200, 401

#### `GET /rider/incentives` — Active incentive schemes + progress

Auth: Bearer token

Responses: 200, 401

#### `GET /rider/heatmap` — Demand zones

Open requests vs online riders per ~1 km cell over the last hour, within 10 km.

Auth: Bearer token

Parameters:
- `lat` (query): Defaults to your last location
- `lng` (query): Defaults to your last location

Responses: 200, 401

#### `POST /rider/sos` — Raise SOS

Alerts admins live (`sos:alert` on the /admin socket) and SMSes the emergency contacts a map link.

Auth: Bearer token

Body:
- `lat` (number, required)
- `lng` (number, required)
- `bookingId` (string): Optional; must be your booking e.g. `"665f1c2e9b1e8a0012345678"`
- `note` (string)

Responses: 201, 400, 401, 404

#### `GET /rider/tickets` — My support tickets

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)

Responses: 200, 401

#### `POST /rider/tickets` — Raise a support ticket

Auth: Bearer token

Body:
- `subject` (string, required)
- `category` (enum(payment|booking|driver|vehicle|lost_item|refund|cancellation|technical), required)
- `description` (string)
- `bookingId` (string) e.g. `"665f1c2e9b1e8a0012345678"`

Responses: 201, 400, 401, 404

#### `GET /rider/notifications` — Notification inbox

Personal notifications (marked read when returned) plus `announcements`: admin push broadcasts from the last 30 days.

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)

Responses: 200, 401



## Common

#### `GET /common/app-config` — Min version, feature flags, support numbers

Auth: Public (no token)

Parameters:
- `app` (query): customer or rider

Responses: 200

#### `GET /common/cms/{slug}` — Terms, privacy, FAQs

Auth: Public (no token)

Parameters:
- `slug` (path, required): Page

Responses: 200, 404

**Web pages (not under `/api/v1`):** the same CMS text is also served as a public HTML page at the site root, for the Play Store / App Store privacy-policy link and in-app web views:
- `GET /terms` — Terms & Conditions (`terms`)
- `GET /privacy` — Privacy Policy (`privacy`)
- `GET /rider-terms` — Rider Terms (`rider_terms`)

Example: `https://<PUBLIC_BASE_URL>/privacy`. Returns 404 while the page has no content.

#### `POST /common/devices` — Register an FCM token

Auth: Bearer token

Body:
- `token` (string, required)
- `platform` (enum(android|ios|web))
- `appVersion` (string)

Responses: 201, 400, 401


## Public

#### `GET /public/track/{token}` — Public tracking page data (share link)

Auth: Public (no token)

Parameters:
- `token` (path, required): Share token

Responses: 200, 404

#### `GET /public/invoices/{token}` — Invoice PDF

Auth: Public (no token)

Parameters:
- `token` (path, required): Invoice token

Responses: 200, 404


## App Auth

#### `POST /app/auth/otp/send` — Send a login OTP by SMS

Step 1 of phone login and sign-up. Works for new and existing numbers.

Resend cooldown `OTP_RESEND_COOLDOWN_SECONDS` (default 30s); at most `OTP_MAX_SENDS_PER_HOUR` (default 5) sends per number per hour.

Blocked/suspended accounts get `403`. All app APIs return `503` while Settings → Maintenance mode is on.

Auth: Public (no token)

Body:
- `phone` (string, required): 10-digit Indian mobile; +91 / 0 prefixes and spaces are accepted e.g. `"9876543210"`
- `userType` (enum(customer|driver|partner), required)

Responses: 200, 400, 403, 429

#### `POST /app/auth/otp/resend` — Resend the login OTP

Same as `/app/auth/otp/send`: issues a fresh code and invalidates the previous one.

Auth: Public (no token)

Body:
- `phone` (string, required): 10-digit Indian mobile; +91 / 0 prefixes and spaces are accepted e.g. `"9876543210"`
- `userType` (enum(customer|driver|partner), required)

Responses: 200, 400, 403, 429

#### `POST /app/auth/otp/verify` — Verify the OTP and log in

Existing user: `isNewUser: false` with tokens.

New number: `isNewUser: true` with a `registrationToken` (valid 30 min) for `/app/auth/register`.

Wrong codes return `attemptsLeft`; after 5 wrong attempts a new OTP must be requested.

Auth: Public (no token)

Body:
- `phone` (string, required): 10-digit Indian mobile; +91 / 0 prefixes and spaces are accepted e.g. `"9876543210"`
- `userType` (enum(customer|driver|partner), required)
- `otp` (string, required) e.g. `"123456"`

Responses: 200, 400, 403, 429

#### `POST /app/auth/register` — Complete sign-up for a new phone number

Required fields depend on the `userType` the OTP was verified for:

This is the app **Profile** screen for customers and riders/drivers.

- **customer**: `name`, `emergencyContact` (optional `email`, `gender`, `dateOfBirth`, `city`)
- **driver**: `name`, `emergencyContact`, `serviceType` (`rider` or `transport`) (optional `email`, `gender`, `dateOfBirth`; must be 18+ if given). Starts as `approvalStatus: pending` until an admin verifies documents.
- **partner**: `companyName`, `ownerName` (optional `email`, `businessRegNo`, `taxId`). Starts as `pending`.

Auth: Public (no token)

Body:
- `registrationToken` (string, required)
- `name` (string): customer / driver (required) e.g. `"Aarav Patel"`
- `email` (string)
- `gender` (enum(male|female|other)): customer / driver
- `dateOfBirth` (string): customer / driver, YYYY-MM-DD e.g. `"1995-08-14"`
- `emergencyContact` (object)
  - `name` (string, required) e.g. `"Riya Patel"`
  - `phone` (string, required): Indian mobile; stored as +91XXXXXXXXXX. Must differ from the user’s own number. e.g. `"9876543222"`
- `city` (string): customer
- `serviceType` (enum(rider|transport)): driver
- `companyName` (string): partner
- `ownerName` (string): partner
- `businessRegNo` (string): partner
- `taxId` (string): partner

Responses: 201, 400, 409

#### `POST /app/auth/refresh` — Exchange an app refresh token for a new token pair

Auth: Public (no token)

Body:
- `refreshToken` (string, required)

Responses: 200, 401

#### `GET /app/auth/me` — Profile of the logged-in app user

Auth: Bearer token

Responses: 200, 401

#### `POST /app/auth/logout` — Log out (the app discards its tokens)

Auth: Bearer token

Responses: 204, 401


## App Profile

#### `GET /app/profile` — Get the Profile screen data

Same record as `/app/auth/me`. `profileComplete: false` means the app should show the Profile screen (name or emergency contact missing).

Auth: Bearer token

Responses: 200, 401

#### `PATCH /app/profile` — Update the profile

Send only the fields that changed. Customers and riders/drivers: `name`, `email`, `gender`, `dateOfBirth`, `emergencyContact` (plus `city` for customers).

Send `null` or `""` for `email`, `gender` or `dateOfBirth` to clear them. The emergency contact can be replaced but not removed.

The phone number is the OTP-verified login and cannot be changed here; sending the same number back is allowed.

Partners: `companyName`, `ownerName`, `email`, `businessRegNo`, `taxId`.

Auth: Bearer token

Body:
- `name` (string) e.g. `"Aarav Patel"`
- `email` (string)
- `gender` (enum(male|female|other))
- `dateOfBirth` (string) e.g. `"1995-08-14"`
- `emergencyContact` (object)
  - `name` (string, required) e.g. `"Riya Patel"`
  - `phone` (string, required): Indian mobile; stored as +91XXXXXXXXXX. Must differ from the user’s own number. e.g. `"9876543222"`
- `city` (string): customer
- `companyName` (string): partner
- `ownerName` (string): partner
- `businessRegNo` (string): partner
- `taxId` (string): partner

Responses: 200, 400, 401, 409


## Admin Auth

#### `POST /admin/auth/login` — Step 1: log in with email and password

Rate-limited to 10 attempts per 15 minutes. Suspended accounts get `403`.

When admin OTP is enabled (default), returns an `AdminOtpChallenge` and sends an OTP by SMS; finish with `/admin/auth/login/verify-otp`. When disabled, returns tokens directly.

Auth: Public (no token)

Body:
- `email` (string, required) e.g. `"admin@rideflow.demo"`
- `password` (string, required) e.g. `"password"`

Responses: 200, 400, 403, 429

#### `POST /admin/auth/login/verify-otp` — Step 2: verify the login OTP

Returns tokens on success. Wrong codes return `attemptsLeft`. `401` means the `otpToken` expired and the admin must sign in again.

Auth: Public (no token)

Body:
- `otpToken` (string, required)
- `otp` (string, required) e.g. `"123456"`

Responses: 200, 400, 429

#### `POST /admin/auth/login/resend-otp` — Resend the login OTP

Auth: Public (no token)

Body:
- `otpToken` (string, required)

Responses: 200, 429

#### `POST /admin/auth/refresh` — Exchange a refresh token for a new token pair

Auth: Public (no token)

Body:
- `refreshToken` (string, required)

Responses: 200, 401

#### `POST /admin/auth/logout` — Log out (records an audit entry)

Auth: Bearer token

Responses: 204, 401

#### `GET /admin/auth/me` — Current admin with role permissions

Auth: Bearer token

Responses: 200, 401


## Dashboard

#### `GET /admin/dashboard/stats` — Live dashboard KPIs

Totals, today’s bookings and revenue, 30-day ride/transport split and status mix, 7-day revenue trend, recent bookings, pending approvals and alerts, all computed live.

**Permission:** `dashboard.view`

Auth: Bearer token

Responses: 200, 401, 403


## Admins

#### `GET /admin/admins` — List admin users

**Permission:** `admins.view`

Auth: Bearer token

Responses: 200, 401, 403

#### `POST /admin/admins` — Create an admin user

The new admin gets the default seed password (`SEED_ADMIN_PASSWORD`).

**Permission:** `admins.manage`

Auth: Bearer token

Body:
- `name` (string, required)
- `email` (string, required)
- `phone` (string, required)
- `role` (enum(super_admin|operations_admin|finance_admin|support_admin|content_admin), required)

Responses: 201, 400, 401, 403, 409

#### `PATCH /admin/admins/{id}` — Update an admin user

You cannot suspend or demote your own Super Admin account.

**Permission:** `admins.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `name` (string)
- `phone` (string)
- `role` (enum(super_admin|operations_admin|finance_admin|support_admin|content_admin))
- `status` (enum(active|suspended))

Responses: 200, 400, 401, 403, 404


## Roles

#### `GET /admin/roles` — List roles and their permissions

**Permission:** `roles.view`

Auth: Bearer token

Responses: 200, 401, 403

#### `PATCH /admin/roles/{key}` — Replace a role's permission list

**Permission:** `roles.manage`

Auth: Bearer token

Parameters:
- `key` (path, required): Role key

Body:
- `permissions` (string[], required)

Responses: 200, 400, 401, 403, 404


## Audit Logs

#### `GET /admin/audit-logs` — Latest 500 audit log entries

**Permission:** `audit_logs.view`

Auth: Bearer token

Responses: 200, 401, 403


## Settings

#### `GET /admin/settings` — Get platform settings

**Permission:** `settings.view`

Auth: Bearer token

Responses: 200, 401, 403

#### `PATCH /admin/settings` — Update platform settings

Send only the fields to change.

**Permission:** `settings.manage`

Auth: Bearer token

Body:
- `platformName` (string)
- `supportEmail` (string)
- `supportPhone` (string)
- `defaultCurrency` (string) e.g. `"INR"`
- `defaultCountry` (string) e.g. `"India"`
- `rideServiceEnabled` (boolean)
- `transportServiceEnabled` (boolean)
- `maintenanceMode` (boolean)
- `otpExpiryMinutes` (integer): Validity of admin and app OTPs
- `adminLoginOtpEnabled` (boolean): Require an SMS OTP after the admin password
- `accessTokenTtlMinutes` (integer)
- `refreshTokenTtlDays` (integer)

Responses: 200, 401, 403


## Customers

#### `GET /admin/users/customers` — List customers

**Permission:** `users.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `q` (query): Case-insensitive search on name, email, phone
- `status` (query): Filter by status

Responses: 200, 401, 403

#### `PATCH /admin/users/customers/{id}` — Change customer status

**Permission:** `users.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `status` (enum(active|suspended|blocked), required)

Responses: 200, 400, 401, 403, 404


## Drivers

#### `GET /admin/users/drivers` — List riders and drivers

Riders and drivers share one collection; filter with `serviceType`.

**Permission:** `users.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `q` (query): Case-insensitive search on name, email, phone
- `serviceType` (query): rider or transport
- `status` (query): Account status
- `approvalStatus` (query): KYC approval status

Responses: 200, 401, 403

#### `PATCH /admin/users/drivers/{id}` — Approve/reject or change driver status

**Permission:** `users.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `approvalStatus` (enum(pending|verified|rejected))
- `status` (enum(active|suspended|blocked))

Responses: 200, 401, 403, 404


## Partners

#### `GET /admin/users/partners` — List transport partners

**Permission:** `users.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `q` (query): Case-insensitive search on companyName, ownerName, email, phone
- `status` (query): Account status
- `approvalStatus` (query): KYC approval status

Responses: 200, 401, 403

#### `PATCH /admin/users/partners/{id}` — Approve/reject or change partner status

**Permission:** `users.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `approvalStatus` (enum(pending|verified|rejected))
- `status` (enum(active|suspended|blocked))

Responses: 200, 401, 403, 404


## Bookings

#### `GET /admin/bookings` — List bookings

**Permission:** `bookings.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `mode` (query): Service mode
- `status` (query): One status, or several comma-separated (e.g. `requested,accepted`)
- `paymentStatus` (query): Payment status
- `q` (query): Search by booking code

Responses: 200, 401, 403

#### `GET /admin/bookings/available-drivers` — Online, active drivers available for manual assignment

**Permission:** `bookings.view`

Auth: Bearer token

Parameters:
- `mode` (query): ride limits to riders and drivers
- `categoryKey` (query): Category key (currently unused by the server)

Responses: 200, 401, 403

#### `GET /admin/bookings/{id}` — Get a booking with customer, driver, vehicle and partner

**Permission:** `bookings.view`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 401, 403, 404

#### `PATCH /admin/bookings/{id}/assign` — Manually assign a driver (and optionally a vehicle)

A `requested` booking moves to `accepted`.

**Permission:** `bookings.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `driverId` (string, required) e.g. `"665f1c2e9b1e8a0012345678"`
- `vehicleId` (string): Optional e.g. `"665f1c2e9b1e8a0012345678"`

Responses: 200, 400, 401, 403, 404

#### `PATCH /admin/bookings/{id}/status` — Change booking status

Adds a timeline entry. For `cancelled`, also records who cancelled and why.

**Permission:** `bookings.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `status` (enum(scheduled|requested|no_rider_found|accepted|arriving|arrived|started|in_transit|completed|cancelled), required)
- `note` (string)
- `cancelledBy` (enum(customer|driver|admin)): Only used when status is cancelled
- `reason` (string): Cancellation reason

Responses: 200, 400, 401, 403, 404


## Service Categories

#### `GET /admin/service-categories` — List service categories

**Permission:** `bookings.view`

Auth: Bearer token

Parameters:
- `mode` (query): Service mode

Responses: 200, 401, 403

#### `POST /admin/service-categories` — Create a service category

**Permission:** `bookings.manage`

Auth: Bearer token

Body:
- `mode` (enum(ride|transport), required)
- `key` (string, required) e.g. `"bike"`
- `name` (string, required) e.g. `"Bike"`
- `description` (string)
- `icon` (string)
- `seats` (integer)
- `capacityLabel` (string)
- `vehicleType` (string): VehicleType id e.g. `"665f1c2e9b1e8a0012345678"`
- `status` (enum(active|inactive))
- `sortOrder` (integer)

Responses: 201, 400, 401, 403, 409

#### `PATCH /admin/service-categories/{id}` — Update a service category

**Permission:** `bookings.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `name` (string)
- `description` (string)
- `icon` (string)
- `seats` (integer)
- `capacityLabel` (string)
- `vehicleType` (string): VehicleType id e.g. `"665f1c2e9b1e8a0012345678"`
- `status` (enum(active|inactive))
- `sortOrder` (integer)

Responses: 200, 401, 403, 404

#### `DELETE /admin/service-categories/{id}` — Delete a service category

**Permission:** `bookings.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 204, 401, 403, 404


## SOS

#### `GET /admin/sos` — List SOS requests

**Permission:** `bookings.view`

Auth: Bearer token

Responses: 200, 401, 403

#### `PATCH /admin/sos/{id}` — Update SOS status and/or add a note

**Permission:** `bookings.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `status` (enum(open|acknowledged|resolved))
- `note` (string): Appended to the notes list

Responses: 200, 401, 403, 404


## Vehicles

#### `GET /admin/fleet/vehicles` — List vehicles

**Permission:** `fleet.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `q` (query): Case-insensitive search on registrationNumber, model, manufacturer
- `status` (query): Vehicle status
- `serviceMode` (query): Service mode
- `ownerType` (query): Owner type

Responses: 200, 401, 403

#### `POST /admin/fleet/vehicles` — Register a vehicle

The registration number is stored in upper case and must be unique.

**Permission:** `fleet.manage`

Auth: Bearer token

Body:
- `registrationNumber` (string, required) e.g. `"MH12AB1234"`
- `model` (string, required)
- `manufacturer` (string)
- `vehicleType` (string, required): VehicleType id e.g. `"665f1c2e9b1e8a0012345678"`
- `serviceMode` (enum(ride|transport), required)
- `categoryKey` (string, required)
- `ownerType` (enum(driver|partner), required)
- `ownerId` (string, required): Driver or TransportPartner id e.g. `"665f1c2e9b1e8a0012345678"`
- `capacity` (string)

Responses: 201, 400, 401, 403, 409

#### `PATCH /admin/fleet/vehicles/{id}` — Update a vehicle

**Permission:** `fleet.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `model` (string)
- `manufacturer` (string)
- `vehicleType` (string) e.g. `"665f1c2e9b1e8a0012345678"`
- `capacity` (string)
- `status` (enum(active|inactive|blocked))
- `documentsStatus` (enum(pending|verified|rejected|expired))

Responses: 200, 401, 403, 404


## Vehicle Types

#### `GET /admin/fleet/vehicle-types` — List vehicle types

**Permission:** `fleet.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `q` (query): Case-insensitive search on name
- `serviceMode` (query): Service mode
- `status` (query): Status

Responses: 200, 401, 403

#### `POST /admin/fleet/vehicle-types` — Create a vehicle type

**Permission:** `fleet.manage`

Auth: Bearer token

Body:
- `name` (string, required)
- `serviceMode` (enum(ride|transport), required)
- `capacityLabel` (string)

Responses: 201, 400, 401, 403

#### `PATCH /admin/fleet/vehicle-types/{id}` — Update a vehicle type

**Permission:** `fleet.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `name` (string)
- `serviceMode` (enum(ride|transport))
- `capacityLabel` (string)
- `status` (enum(active|inactive))

Responses: 200, 401, 403, 404


## Documents

#### `GET /admin/fleet/documents` — List KYC and vehicle documents

**Permission:** `fleet.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `ownerType` (query): Owner type
- `status` (query): Review status

Responses: 200, 401, 403

#### `POST /admin/fleet/documents` — Add a document record

**Permission:** `fleet.manage`

Auth: Bearer token

Body:
- `ownerType` (enum(driver|partner|vehicle), required)
- `ownerId` (string, required) e.g. `"665f1c2e9b1e8a0012345678"`
- `docType` (string, required) e.g. `"driving_license"`
- `fileUrl` (string, required)
- `expiryDate` (string)

Responses: 201, 400, 401, 403

#### `PATCH /admin/fleet/documents/{id}` — Verify, reject or expire a document

**Permission:** `fleet.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `status` (enum(pending|verified|rejected|expired), required)
- `rejectionReason` (string): Required when status is rejected

Responses: 200, 400, 401, 403, 404


## Pricing

#### `GET /admin/pricing` — List pricing rules

**Permission:** `pricing.view`

Auth: Bearer token

Parameters:
- `mode` (query): Service mode
- `categoryKey` (query): Category key
- `status` (query): Status

Responses: 200, 401, 403

#### `POST /admin/pricing` — Create a pricing rule

**Permission:** `pricing.manage`

Auth: Bearer token

Body:
- `mode` (enum(ride|transport), required)
- `categoryKey` (string, required) e.g. `"bike"`
- `serviceArea` (string): ServiceArea id e.g. `"665f1c2e9b1e8a0012345678"`
- `baseFare` (number, required) e.g. `25`
- `perKm` (number, required) e.g. `8`
- `perMinute` (number)
- `minimumFare` (number, required) e.g. `40`
- `waitingChargePerMin` (number)
- `nightChargeMultiplier` (number)
- `platformFeeFlat` (number)
- `platformFeePercent` (number)
- `cancellationFee` (number)
- `loadingUnloadingCharge` (number)
- `additionalStopCharge` (number)
- `taxPercent` (number)
- `effectiveFrom` (string)
- `status` (enum(active|inactive))

Responses: 201, 400, 401, 403

#### `PATCH /admin/pricing/{id}` — Update a pricing rule

**Permission:** `pricing.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `mode` (enum(ride|transport), required)
- `categoryKey` (string, required) e.g. `"bike"`
- `serviceArea` (string): ServiceArea id e.g. `"665f1c2e9b1e8a0012345678"`
- `baseFare` (number, required) e.g. `25`
- `perKm` (number, required) e.g. `8`
- `perMinute` (number)
- `minimumFare` (number, required) e.g. `40`
- `waitingChargePerMin` (number)
- `nightChargeMultiplier` (number)
- `platformFeeFlat` (number)
- `platformFeePercent` (number)
- `cancellationFee` (number)
- `loadingUnloadingCharge` (number)
- `additionalStopCharge` (number)
- `taxPercent` (number)
- `effectiveFrom` (string)
- `status` (enum(active|inactive))

Responses: 200, 401, 403, 404

#### `DELETE /admin/pricing/{id}` — Deactivate a pricing rule

Soft delete: sets `status` to `inactive` and returns the rule.

**Permission:** `pricing.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 401, 403, 404


## Commissions

#### `GET /admin/commissions` — List commission rules

**Permission:** `finance.view`

Auth: Bearer token

Parameters:
- `appliesTo` (query): Payee type
- `categoryKey` (query): Category key
- `status` (query): Status

Responses: 200, 401, 403

#### `POST /admin/commissions` — Create a commission rule

**Permission:** `finance.manage`

Auth: Bearer token

Body:
- `appliesTo` (enum(driver|partner), required)
- `categoryKey` (string)
- `type` (enum(percentage|fixed), required)
- `value` (number, required) e.g. `15`
- `effectiveFrom` (string)
- `status` (enum(active|inactive))

Responses: 201, 400, 401, 403

#### `PATCH /admin/commissions/{id}` — Update a commission rule

**Permission:** `finance.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `appliesTo` (enum(driver|partner), required)
- `categoryKey` (string)
- `type` (enum(percentage|fixed), required)
- `value` (number, required) e.g. `15`
- `effectiveFrom` (string)
- `status` (enum(active|inactive))

Responses: 200, 401, 403, 404

#### `DELETE /admin/commissions/{id}` — Deactivate a commission rule

Soft delete: sets `status` to `inactive` and returns the rule.

**Permission:** `finance.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 401, 403, 404


## Payments

#### `GET /admin/payments` — List payments

**Permission:** `finance.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `status` (query): Payment status
- `method` (query): Payment method
- `q` (query): Search by booking code

Responses: 200, 401, 403


## Refunds

#### `GET /admin/refunds` — List refunds

**Permission:** `finance.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `status` (query): Refund status

Responses: 200, 401, 403

#### `PATCH /admin/refunds/{id}/approve` — Approve a requested refund

**Permission:** `finance.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 400, 401, 403, 404

#### `PATCH /admin/refunds/{id}/reject` — Reject a requested refund

**Permission:** `finance.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `reason` (string)

Responses: 200, 400, 401, 403, 404

#### `PATCH /admin/refunds/{id}/process` — Process an approved refund

Credits the refund amount to the customer's wallet (created if missing) and records a wallet transaction.

**Permission:** `finance.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 400, 401, 403, 404


## Wallets

#### `GET /admin/wallets` — List wallets

**Permission:** `finance.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `ownerType` (query): Owner type

Responses: 200, 401, 403

#### `GET /admin/wallets/{id}/transactions` — List transactions for a wallet

**Permission:** `finance.view`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 401, 403, 404

#### `POST /admin/wallets/{id}/adjust` — Manually credit or debit a wallet

**Permission:** `finance.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `type` (enum(credit|debit), required)
- `amount` (number, required) e.g. `100`
- `reason` (enum(booking_earning|booking_payment|tip|commission|recharge|refund|penalty|bonus|withdrawal|adjustment)): Defaults to adjustment when missing or unknown

Responses: 200, 400, 401, 403, 404


## Settlements

#### `GET /admin/settlements` — List driver and partner settlements

**Permission:** `finance.view`

Auth: Bearer token

Parameters:
- `page` (query): Page number (1-based)
- `limit` (query): Items per page (max 100)
- `payeeType` (query): Payee type
- `status` (query): Status

Responses: 200, 401, 403

#### `PATCH /admin/settlements/{id}/mark-paid` — Mark a settlement as paid

**Permission:** `finance.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 400, 401, 403, 404


## Coupons

#### `GET /admin/coupons` — List coupons and offers

**Permission:** `marketing.view`

Auth: Bearer token

Parameters:
- `autoApply` (query): true = offers, false = coupon codes
- `status` (query): Status
- `q` (query): Case-insensitive search on title, code

Responses: 200, 401, 403

#### `POST /admin/coupons` — Create a coupon or offer

**Permission:** `marketing.manage`

Auth: Bearer token

Body:
- `code` (string): Leave empty for auto-apply offers e.g. `"WELCOME50"`
- `title` (string, required) e.g. `"Welcome offer"`
- `autoApply` (boolean): true = offer, false = coupon code
- `discountType` (enum(flat|percentage), required)
- `amount` (number, required) e.g. `50`
- `minBookingAmount` (number)
- `maxDiscount` (number)
- `validFrom` (string, required)
- `validTo` (string, required)
- `usageLimitTotal` (integer)
- `usageLimitPerUser` (integer)
- `applicableMode` (enum(ride|transport|both))
- `applicableCategories` (string[])
- `serviceAreas` (string[])
- `status` (enum(active|inactive))

Responses: 201, 400, 401, 403

#### `GET /admin/coupons/{id}` — Get a coupon

**Permission:** `marketing.view`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 401, 403, 404

#### `PATCH /admin/coupons/{id}` — Update a coupon

**Permission:** `marketing.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `code` (string): Leave empty for auto-apply offers e.g. `"WELCOME50"`
- `title` (string, required) e.g. `"Welcome offer"`
- `autoApply` (boolean): true = offer, false = coupon code
- `discountType` (enum(flat|percentage), required)
- `amount` (number, required) e.g. `50`
- `minBookingAmount` (number)
- `maxDiscount` (number)
- `validFrom` (string, required)
- `validTo` (string, required)
- `usageLimitTotal` (integer)
- `usageLimitPerUser` (integer)
- `applicableMode` (enum(ride|transport|both))
- `applicableCategories` (string[])
- `serviceAreas` (string[])
- `status` (enum(active|inactive))

Responses: 200, 401, 403, 404

#### `DELETE /admin/coupons/{id}` — Delete a coupon

**Permission:** `marketing.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 204, 401, 403, 404


## Banners

#### `GET /admin/banners` — List banners

**Permission:** `marketing.view`

Auth: Bearer token

Parameters:
- `status` (query): Status
- `serviceMode` (query): Service mode

Responses: 200, 401, 403

#### `POST /admin/banners` — Create a banner

**Permission:** `marketing.manage`

Auth: Bearer token

Body:
- `title` (string, required)
- `description` (string)
- `imageUrl` (string, required)
- `ctaLabel` (string)
- `targetLink` (string)
- `serviceMode` (enum(ride|transport|both))
- `startDate` (string, required)
- `endDate` (string, required)
- `status` (enum(active|inactive))

Responses: 201, 400, 401, 403

#### `GET /admin/banners/{id}` — Get a banner

**Permission:** `marketing.view`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 401, 403, 404

#### `PATCH /admin/banners/{id}` — Update a banner

**Permission:** `marketing.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `title` (string, required)
- `description` (string)
- `imageUrl` (string, required)
- `ctaLabel` (string)
- `targetLink` (string)
- `serviceMode` (enum(ride|transport|both))
- `startDate` (string, required)
- `endDate` (string, required)
- `status` (enum(active|inactive))

Responses: 200, 401, 403, 404

#### `DELETE /admin/banners/{id}` — Delete a banner

**Permission:** `marketing.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 204, 401, 403, 404


## Notifications

#### `GET /admin/notifications/templates` — List notification templates

**Permission:** `marketing.view`

Auth: Bearer token

Responses: 200, 401, 403

#### `POST /admin/notifications/templates` — Create a notification template

**Permission:** `marketing.manage`

Auth: Bearer token

Body:
- `key` (string, required) e.g. `"booking_confirmed"`
- `channel` (enum(push|sms|email), required)
- `title` (string)
- `body` (string, required)
- `status` (enum(active|inactive))

Responses: 201, 400, 401, 403

#### `PATCH /admin/notifications/templates/{id}` — Update a notification template

**Permission:** `marketing.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `key` (string, required) e.g. `"booking_confirmed"`
- `channel` (enum(push|sms|email), required)
- `title` (string)
- `body` (string, required)
- `status` (enum(active|inactive))

Responses: 200, 401, 403, 404

#### `GET /admin/notifications/broadcasts` — List sent broadcasts

**Permission:** `marketing.view`

Auth: Bearer token

Responses: 200, 401, 403

#### `POST /admin/notifications/broadcasts` — Send a broadcast

Nothing is actually delivered yet; the server records the broadcast with an estimated recipient count.

**Permission:** `marketing.manage`

Auth: Bearer token

Body:
- `templateId` (string): Optional template id e.g. `"665f1c2e9b1e8a0012345678"`
- `channel` (enum(push|sms|email), required)
- `audience` (enum(all_customers|all_drivers|all_partners|custom), required)
- `serviceModeFilter` (enum(ride|transport|both))
- `title` (string, required)
- `body` (string, required)

Responses: 201, 400, 401, 403


## CMS

#### `GET /admin/cms` — List all CMS pages

Missing pages are created empty on first read.

**Permission:** `marketing.view`

Auth: Bearer token

Responses: 200, 401, 403

#### `GET /admin/cms/{slug}` — Get a CMS page

**Permission:** `marketing.view`

Auth: Bearer token

Parameters:
- `slug` (path, required): Page slug

Responses: 200, 401, 403, 404

#### `PATCH /admin/cms/{slug}` — Update a CMS page

**Permission:** `marketing.manage`

Auth: Bearer token

Parameters:
- `slug` (path, required): Page slug

Body:
- `title` (string)
- `content` (string): HTML or Markdown content

Responses: 200, 401, 403, 404


## Service Areas

#### `GET /admin/service-areas` — List service areas

**Permission:** `settings.view`

Auth: Bearer token

Parameters:
- `status` (query): Status
- `q` (query): Case-insensitive search on name, city, state

Responses: 200, 401, 403

#### `POST /admin/service-areas` — Create a service area

**Permission:** `settings.manage`

Auth: Bearer token

Body:
- `name` (string, required) e.g. `"Pune Central"`
- `country` (string, required) e.g. `"India"`
- `state` (string, required) e.g. `"Maharashtra"`
- `city` (string, required) e.g. `"Pune"`
- `zone` (string)
- `status` (enum(active|inactive))
- `rideEnabled` (boolean)
- `transportEnabled` (boolean)
- `geofence` (object)
  - `centerLat` (number)
  - `centerLng` (number)
  - `radiusKm` (number)

Responses: 201, 400, 401, 403

#### `GET /admin/service-areas/{id}` — Get a service area

**Permission:** `settings.view`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 401, 403, 404

#### `PATCH /admin/service-areas/{id}` — Update a service area

**Permission:** `settings.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `name` (string, required) e.g. `"Pune Central"`
- `country` (string, required) e.g. `"India"`
- `state` (string, required) e.g. `"Maharashtra"`
- `city` (string, required) e.g. `"Pune"`
- `zone` (string)
- `status` (enum(active|inactive))
- `rideEnabled` (boolean)
- `transportEnabled` (boolean)
- `geofence` (object)
  - `centerLat` (number)
  - `centerLng` (number)
  - `radiusKm` (number)

Responses: 200, 401, 403, 404

#### `DELETE /admin/service-areas/{id}` — Delete a service area

**Permission:** `settings.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 204, 401, 403, 404


## Tickets

#### `GET /admin/tickets` — List support tickets

**Permission:** `support.view`

Auth: Bearer token

Parameters:
- `category` (query): Category
- `status` (query): Status
- `priority` (query): Priority
- `q` (query): Case-insensitive search on subject, raisedByName

Responses: 200, 401, 403

#### `GET /admin/tickets/{id}` — Get a ticket

**Permission:** `support.view`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Responses: 200, 401, 403, 404

#### `PATCH /admin/tickets/{id}` — Update status, priority, assignee or add a note

Assigning an `open` ticket moves it to `assigned`.

**Permission:** `support.manage`

Auth: Bearer token

Parameters:
- `id` (path, required): MongoDB ObjectId

Body:
- `status` (enum(open|assigned|in_progress|resolved|closed))
- `priority` (enum(low|medium|high))
- `assignedTo` (string): Admin id; null to unassign e.g. `"665f1c2e9b1e8a0012345678"`
- `note` (string): Appended to the notes list

Responses: 200, 401, 403, 404


## Ratings

#### `GET /admin/ratings` — List ratings and reviews

**Permission:** `support.view`

Auth: Bearer token

Parameters:
- `ratedBy` (query): Who gave the rating
- `minScore` (query): Minimum score

Responses: 200, 401, 403


## Reports

#### `GET /admin/reports/booking` — Booking report

Up to 1000 rows, newest first.

**Permission:** `reports.view`

Auth: Bearer token

Parameters:
- `from` (query): Start date (ISO). Defaults to 30 days ago.
- `to` (query): End date (ISO). A date-only value includes the whole day. Defaults to now.
- `mode` (query): Service mode
- `status` (query): Booking status

Responses: 200, 401, 403

#### `GET /admin/reports/revenue` — Revenue report (completed bookings)

**Permission:** `reports.view`

Auth: Bearer token

Parameters:
- `from` (query): Start date (ISO). Defaults to 30 days ago.
- `to` (query): End date (ISO). A date-only value includes the whole day. Defaults to now.

Responses: 200, 401, 403

#### `GET /admin/reports/rider` — Rider and driver performance report

**Permission:** `reports.view`

Auth: Bearer token

Parameters:
- `from` (query): Start date (ISO). Defaults to 30 days ago.
- `to` (query): End date (ISO). A date-only value includes the whole day. Defaults to now.

Responses: 200, 401, 403

#### `GET /admin/reports/partner` — Transport partner report

**Permission:** `reports.view`

Auth: Bearer token

Parameters:
- `from` (query): Start date (ISO). Defaults to 30 days ago.
- `to` (query): End date (ISO). A date-only value includes the whole day. Defaults to now.

Responses: 200, 401, 403

#### `GET /admin/reports/financial` — Financial report (payments, refunds, wallets)

**Permission:** `reports.view`

Auth: Bearer token

Parameters:
- `from` (query): Start date (ISO). Defaults to 30 days ago.
- `to` (query): End date (ISO). A date-only value includes the whole day. Defaults to now.

Responses: 200, 401, 403
