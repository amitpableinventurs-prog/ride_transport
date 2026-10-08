# AnZ Cabs customer app: Home, Pickup, Services and Refer & Earn APIs

Base URL: `http://localhost:5050/api/v1` (set `PORT` in `server/.env`).
Live Swagger: `http://localhost:5050/api-docs` (tag **Customer**).

All `/customer/*` calls need `Authorization: Bearer <accessToken>` from the OTP login:

1. `POST /app/auth/otp/send` `{ "phone": "9876500011", "userType": "customer" }`
2. `POST /app/auth/otp/verify` `{ "phone": "...", "userType": "customer", "otp": "123456" }`. An existing user gets `accessToken` and `refreshToken`. A new number gets `isNewUser: true` and a `registrationToken`: finish with `POST /app/auth/register` (name and emergency contact).
3. `POST /app/auth/refresh` when the access token expires (the refresh token is single use: store the new one)

Errors are `{ "message": "..." }` with a 4xx status.

## Screen to API map

| Screen | What it shows | API |
|---|---|---|
| Home (map) | Pickup pin address, serviceable or not | `GET /customer/places/reverse`, `GET /customer/home` |
| Home | "Where do you want to go?" recent list with hearts | `GET /customer/recent-places` (also in `/home`) |
| Pickup | Pickup/drop search | `GET /customer/places/search` |
| Pickup | Heart on a recent place | `POST /customer/saved-places`, `DELETE /customer/saved-places/:id` |
| Pickup | "For me" dropdown | Not supported yet: bookings have no passenger field (see Notes) |
| Home tab (Ride / Transport) | "Hi Nikhil", avatar "N", category cards | `GET /customer/home`, `GET /customer/services` |
| Service tab ("All Services") | Ride and Transport sections with every category | `GET /customer/all-services` |
| Refer & Earn | Code, copy, how it works | `GET /customer/referral` |
| Refer & Earn | Friend enters a code | `POST /customer/referral/apply` |

## New endpoints

### GET /customer/all-services
Query: `lat`, `lng` (optional). The whole "All Services" screen in one call; nothing else is needed to draw it.

```json
{
  "serviceable": true,
  "serviceArea": { "id": "...", "name": "Mumbai Metro", "city": "Mumbai" },
  "message": null,
  "sections": [
    {
      "mode": "ride", "title": "Ride", "subtitle": "City trips for people. Pick an auto, bike or cab.", "enabled": true,
      "items": [ { "key": "auto", "name": "Auto", "description": "Budget-friendly 3-seater", "icon": "car-taxi-front", "seats": 3, "capacityLabel": null, "available": true, "ridersNearby": 2, "etaMin": 4 } ]
    },
    { "mode": "transport", "title": "Transport", "subtitle": "Send goods across the city, from a bike parcel to a large truck.", "enabled": true, "items": [] }
  ]
}
```
- Item order and which items appear are managed in the admin panel (Operations → Categories: active/inactive, sort order, name, icon).
- Without `lat`/`lng`: `serviceable` is `null`, every active category is listed and `ridersNearby` / `etaMin` are `null`.
- Outside every service area: `serviceable: false`, a `message`, and every item has `available: false`.
- `icon` is a name set in the admin panel (e.g. `bike`, `car`); the app maps it to its own artwork.
- The section titles and subtitles are fixed in the server code, not editable from the admin panel.
- Tapping an item continues to `POST /customer/fare-estimate` with its `key` as `categoryKey`.

### GET /customer/home
Query: `lat`, `lng` (optional). One call for the Home tab.

```json
{
  "name": "Nikhil Verma", "firstName": "Nikhil", "initial": "N",
  "serviceable": true, "city": "Indore",
  "modes": { "ride": true, "transport": true },
  "activeBooking": { "id": "...", "bookingCode": "BK-1042", "status": "accepted", "mode": "ride", "categoryKey": "auto", "drop": { "address": "...", "lat": 0, "lng": 0 } },
  "savedPlaces": [],
  "recentPlaces": [ { "name": "Vijay Nagar", "address": "Vijay Nagar, Indore", "lat": 22.75, "lng": 75.89, "favouriteId": null } ]
}
```
`serviceable` is `null` when `lat`/`lng` are omitted. `activeBooking` is `null` when nothing is open: if set, show the live-trip banner and open tracking.

### GET /customer/recent-places
Query: `limit` (default 6, max 20). Returns the same array as `recentPlaces` above: distinct drop-offs from past non-cancelled bookings, newest first.

**Heart button:** `favouriteId` set means filled heart. Tapping it calls `DELETE /customer/saved-places/{favouriteId}`. If it is `null`, call `POST /customer/saved-places` with `{ "label": "other", "name": "Vijay Nagar", "address": "...", "lat": ..., "lng": ... }` (max 10 places) and store the returned `id`.

### GET /customer/places/search
Query: `q` (required), `lat`, `lng` (optional, adds `distanceKm`). Matches the customer's saved and recent places by name or address, max 10.

```json
[ { "name": "Rajwada", "address": "Rajwada, Indore", "lat": 22.718, "lng": 75.855, "favouriteId": null, "distanceKm": 1.2 } ]
```
There is no maps provider on the server yet, so city-wide search while typing must use the app's Google Places SDK. This endpoint gives the personal suggestions to show first.

### GET /customer/places/reverse
Query: `lat`, `lng` (required). Label for the "Pickup Point" pin.

```json
{ "lat": 22.72, "lng": 75.85, "address": "Palasia, Indore", "city": "Indore", "serviceable": true }
```
`address` is a known saved or recent address within 200 m, otherwise `null`: fall back to the Google reverse geocode on the device. `serviceable: false` means show "We don't operate here yet".

### GET /customer/referral
Creates the customer's code on first call (format `RIDE1234`).

```json
{
  "enabled": true, "code": "RIDE6655",
  "title": "Invite friends to AnZ Cabs",
  "description": "When a friend completes their first ride, you both get ride credit.",
  "shareMessage": "Join AnZ Cabs and get ₹50 ride credit ... Use my code RIDE6655 when you sign up.",
  "rewardForYou": 50, "rewardForFriend": 50, "currency": "INR",
  "steps": [ { "step": 1, "title": "Share your code", "description": "..." } ],
  "stats": { "invited": 3, "rewarded": 1, "totalEarned": 50 },
  "referrals": [ { "name": "Asha", "joinedAt": "2026-10-01T10:00:00Z", "status": "rewarded" } ],
  "appliedCode": false
}
```
"Copy code" copies `code`; a Share button sends `shareMessage`. `appliedCode: true` means this customer already used someone's code (hide the "Have a code?" field).

### POST /customer/referral/apply
Body `{ "code": "RIDE6655" }`. Response `{ "message": "...", "rewardForYou": 50 }`.

| Status | Meaning |
|---|---|
| 400 | `code` missing, or own code |
| 404 | Code does not exist |
| 409 | Customer already used a code |
| 422 | Customer already has a completed ride, or referrals are switched off |

**Reward:** when the referred customer's first trip completes, both wallets are credited automatically (wallet transaction reason `referral`). It is paid once only. Amounts come from platform settings (`referralRewardReferrer`, `referralRewardReferee`, default ₹50 each; `referralEnabled`).

## Existing endpoints these screens also use

| Endpoint | Used for |
|---|---|
| `GET /customer/profile` / `PATCH /customer/profile` | Name for the greeting, profile completeness |
| `GET /customer/services?lat=&lng=` | Ride and Transport category cards with `seats`, `capacityLabel`, `ridersNearby`, `etaMin`. The Service tab and the Home Ride/Transport toggle both use `ride[]` and `transport[]` |
| `POST /customer/fare-estimate` | Prices after the user picks pickup and drop |
| `POST /customer/bookings` | Book the ride or transport |
| `GET /customer/offers` | Banners (the "Moving house? Explore" card) and coupons |
| `GET /customer/wallet` | See the referral credit arrive |

## Notes

- Not built: booking for someone else ("For me" dropdown) and "Add stops" for rides. Rides have a single drop (the API returns 400 for more); transport supports up to 5 stops.
- The platform name comes from admin Settings (`platformName`). The current database value is "RideFlow": change it to "AnZ Cabs" in the admin panel Settings so the referral title and share text read correctly.
