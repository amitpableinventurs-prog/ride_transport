# AnZ Cabs Admin Panel

Admin web application and REST API for the Rider & Transport Platform SRS (Rapido + Porter style ride and goods-transport platform).

This repo contains two apps:

- **/** — React + TypeScript + Vite admin frontend (Tailwind CSS v4, React Router, Zustand)
- **/server** — Node.js + Express + TypeScript + MongoDB (Mongoose) REST API + Socket.IO: `/api/v1/admin/*` for this panel; `/api/v1/auth`, `/customer`, `/rider`, `/common` for the Flutter customer and rider apps (SRS §10)

The frontend never encodes business rules itself — RBAC, auth, and audit logging are all enforced by the API, so the same contract can later be consumed by the Flutter apps per the SRS's integration principle.

## Prerequisites

- Node.js 20+
- A MongoDB instance — local (`mongod`) or a connection string from MongoDB Atlas

## 1. Backend setup

```bash
cd server
cp .env.example .env      # edit MONGODB_URI if not using local default
npm install
npm run seed               # creates the 5 system roles + 5 demo admins + settings + dashboard snapshot
npm run dev                 # starts the API on http://localhost:5000
```

Demo login for every seeded admin: password `Admin@123`, then the OTP shown on the login screen (development mode) (see console output from `npm run seed` for the exact value if you changed `SEED_ADMIN_PASSWORD`).

| Role | Email |
|---|---|
| Super Admin | super@rideflow.demo |
| Operations Admin | ops@rideflow.demo |
| Finance Admin | finance@rideflow.demo |
| Support Admin | support@rideflow.demo |
| Content/Admin Manager | content@rideflow.demo |

## 2. Frontend setup

```bash
cp .env.example .env       # VITE_API_BASE_URL defaults to http://localhost:5000/api/v1/admin
npm install
npm run dev                 # starts the admin panel on http://localhost:5173
```

## What's implemented

Every module in the SRS sidebar (section 29) has a working page backed by the API:

- **Operations**: bookings (filters, detail timeline, manual assignment, status changes), Ride/Transport service categories, live tracking, active rides, deliveries, SOS
- **Users**: customers, riders, drivers, transport partners (approval workflow, suspend/block)
- **Fleet**: vehicles, vehicle types, documents (verify/reject/expire)
- **Finance**: payments, wallet transactions, wallets (manual credit/debit), commissions, refunds (approve → process to wallet), settlements
- **Pricing**: ride, transport, surge/night multipliers, cancellation charges
- **Marketing**: coupons, offers, banners, notification templates and broadcasts
- **Support**: complaints/tickets (assign, notes, status), ratings
- **Reports**: booking, revenue, rider, partner, financial (date range + CSV export)
- **System**: admin users, roles & permissions, CMS pages, service areas, settings, audit logs
- **Dashboard**: computed live from the collections (totals, today's bookings/revenue, trends, pending approvals, alerts)

RBAC is enforced by the API on every endpoint, and sensitive actions are audit logged.

## Customer and rider app APIs (SRS §10)

| Prefix | What |
|---|---|
| `/api/v1/auth` | OTP login with `role: customer \| rider`; new numbers get an account at verify (`isNewUser: true`). Refresh tokens rotate; logout revokes them and removes the FCM token |
| `/api/v1/customer` | profile, saved places, SOS contacts, services + ETAs at a location, fare estimate, coupons, booking lifecycle (create / track / change drop / cancel / retry / rate + tip / invoice PDF / share link / call), wallet, payments, offers, SOS, tickets, notifications, account deletion |
| `/api/v1/rider` | profile, onboarding, documents, vehicle, approval status, duty on/off with selfie check, requests (accept / reject), trip flow (arrived / start OTP / transport drops with OTP + POD / complete / cash collected / cancel / rate), earnings, wallet + dues, withdrawals, incentives, heatmap, SOS, tickets |
| `/api/v1/common`, `/api/v1/public` | app config, CMS pages, FCM device registration, public tracking page data, invoice PDF |
| Socket.IO `/customer`, `/rider`, `/admin` | live booking events, rider location, chat, SOS alerts, live rider positions (event list in Swagger) |

**Booking lifecycle:** `scheduled → requested → accepted → arrived → started` (ride) or `in_transit` (transport) `→ completed`. A requested booking is offered to the nearest eligible online rider; they have **Settings → riderRequestTimeoutSeconds** (20s) to accept before it moves to the next rider, up to `maxDispatchAttempts` (5), then `no_rider_found` (the customer can retry). Dispatch and trip rules (radius, free cancellation/waiting minutes, selfie interval, max cash dues, minimum withdrawal) are fields on the Settings document and can be changed through `PATCH /api/v1/admin/settings`.

**Money flow:** cash trips put the platform commission on the rider wallet as dues (a negative balance; riders above `maxCashDues` must pay before going online); wallet and online payments credit the rider's share. Late customer cancellations charge the category cancellation fee to the customer wallet and pay it to the rider.

**Providers (development defaults, swap for production):**

| Env | Default | Notes |
|---|---|---|
| `PAYMENT_PROVIDER` | `mock` | Orders are created locally; verify with `signature: "mock_success"`. Set `razorpay` + `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` for real payments. Mock is refused in production |
| `TELEPHONY_PROVIDER` | `direct` | Returns the real number (`masked: false`). Add a masked-calling provider in `server/src/utils/telephony.ts`; production returns 503 until then |
| `PUSH_PROVIDER` | `console` | Prints pushes. Add FCM in `server/src/utils/notify.ts` |
| `UPLOAD_DIR` | `server/uploads` | Documents, selfies and delivery photos, served at `/uploads`. Move to S3 with signed URLs for production |

Not built yet: real masked calling, FCM delivery, face match on selfies, maps-based routing (distances are straight line × 1.3), S3 presigned uploads, payment/telephony webhooks, and the admin side of rider payouts and incentive schemes.

## OTP

OTPs are 6 digits, stored hashed, valid for **Settings → Security → OTP expiry** minutes, allow 5 wrong attempts, a 30s resend cooldown and 5 sends per number per hour. The SMS text comes from the `otp_sms` notification template (`{{otp}}`, `{{expiry_minutes}}`).

- **Admin login**: email + password, then an OTP sent by SMS to the admin's phone. Toggle with **Settings → Security → Require OTP for admin sign-in**.
- **Mobile apps** (`/api/v1/auth/*`, and the earlier `/api/v1/app/auth/*`): phone OTP login and sign-up. New riders/drivers and partners start as `pending` approval. App tokens use separate secrets and cannot call admin APIs.

**SMS provider:** `SMS_PROVIDER=console` (default) prints each OTP to the server log. Outside production the OTP is also returned as `devOtp` in the API response and shown on the admin login screen. To go live, add a provider (MSG91, Twilio, ...) in `server/src/utils/sms.ts` and set `SMS_PROVIDER`.

## API documentation

Swagger UI: **http://localhost:5000/api-docs** (raw spec at `/api-docs.json`), covering the admin, customer, rider, common and earlier `/app` APIs, plus the Socket.IO events. The spec lives in `server/src/docs/openapi.ts`; update it when you add or change a route.

## Project structure

```
src/
  api/          axios wrappers per resource, calling the real backend
  components/   layout (sidebar/header) + shared UI (StatCard, Badge, Modal, PermissionGate...)
  lib/          sidebar navigation config (maps to SRS section 29)
  pages/        route-level pages, grouped by SRS module
  store/        zustand auth store (access token in memory, refresh token persisted)
  types/        shared frontend types (mirrors the API contract)

server/src/
  config/       env + MongoDB connection
  models/       Mongoose schemas (one per collection)
  middleware/   admin auth + RBAC, app auth + maintenance mode, error handler
  controllers/  route handlers (customer/, rider/, common/ and app/ for the mobile apps)
  routes/       routers mounted at /api/v1/admin/* (routes/app/ for the app APIs)
  services/     dispatch (matching riders), trip money flow, gateway payments
  realtime/     Socket.IO namespaces and emit helpers
  utils/        JWT, OTP + SMS, fare, geo, wallet, payment/telephony/push providers, uploads
  docs/         OpenAPI spec served by Swagger UI at /api-docs
  seed.ts       seeds roles, demo admins, settings, dashboard snapshot
```
