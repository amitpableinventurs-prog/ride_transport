# AnZ Cabs Admin Panel

Admin web application and REST API for the Rider & Transport Platform SRS (Rapido + Porter style ride and goods-transport platform).

This repo contains two apps:

- **/** — React + TypeScript + Vite admin frontend (Tailwind CSS v4, React Router, Zustand)
- **/server** — Node.js + Express + TypeScript + MongoDB (Mongoose) REST API: `/api/v1/admin/*` for this panel and `/api/v1/app/*` for the Flutter apps

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

## OTP

OTPs are 6 digits, stored hashed, valid for **Settings → Security → OTP expiry** minutes, allow 5 wrong attempts, a 30s resend cooldown and 5 sends per number per hour. The SMS text comes from the `otp_sms` notification template (`{{otp}}`, `{{expiry_minutes}}`).

- **Admin login**: email + password, then an OTP sent by SMS to the admin's phone. Toggle with **Settings → Security → Require OTP for admin sign-in**.
- **Mobile apps** (`/api/v1/app/auth/*`): phone OTP login and sign-up for customers, riders/drivers and transport partners. New riders/drivers and partners start as `pending` approval. App tokens use separate secrets and cannot call admin APIs.

**SMS provider:** `SMS_PROVIDER=console` (default) prints each OTP to the server log. Outside production the OTP is also returned as `devOtp` in the API response and shown on the admin login screen. To go live, add a provider (MSG91, Twilio, ...) in `server/src/utils/sms.ts` and set `SMS_PROVIDER`.

## API documentation

Swagger UI: **http://localhost:5000/api-docs** (raw spec at `/api-docs.json`), covering both `/api/v1/admin/*` and `/api/v1/app/*`. The spec lives in `server/src/docs/openapi.ts`; update it when you add or change a route.

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
  controllers/  route handlers (controllers/app/ for the mobile apps)
  routes/       routers mounted at /api/v1/admin/* (routes/app/ at /api/v1/app/*)
  utils/        JWT, bcrypt, OTP + SMS provider, phone normalization, audit log helper
  docs/         OpenAPI spec served by Swagger UI at /api-docs
  seed.ts       seeds roles, demo admins, settings, dashboard snapshot
```
