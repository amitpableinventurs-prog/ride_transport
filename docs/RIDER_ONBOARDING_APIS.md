# AnZ Cabs rider app: sign-up and onboarding APIs

Base URL `http://localhost:5050/api/v1`. All `/rider/*` calls need `Authorization: Bearer <accessToken>` from the OTP login. Swagger: `/api-docs`, tag **Rider**.

## Screen to API map

| Screen | API |
|---|---|
| Landing: "Start Driving" / "Customer? Book Ride" | Not an API. Start Driving goes to the rider login below; the customer link uses the customer login |
| Allow location / notifications | Not an API: the phone asks. Send the FCM token with `POST /common/devices` after login |
| Enter OTP (6 digits, 00:19 timer) | `POST /rider/auth/otp/send`, `POST /rider/auth/otp/verify`. A new number gets a rider account at once (`isNewUser: true`). The resend timer is `resendAfterSeconds` in the send response; resend with `POST /rider/auth/otp/resend` |
| Do you have a Driving License? Yes / No | `PUT /rider/onboarding/license` |
| Vehicle - Bike "Selected" | `GET /rider/onboarding/options`, then `POST /rider/onboarding` |
| Driving License (front, back, number) | `POST /rider/documents` with `docType=driving_license` |
| Photo and name | `PATCH /rider/profile` |
| Vehicle Number (+ optional RC photos) | `POST /rider/vehicle` |
| Aadhaar / PAN Card | `POST /rider/documents` with `docType=aadhaar` or `pan` |
| Documents under verification | `GET /rider/onboarding/status` |
| Help button | `GET /common/app-config` (support numbers), `POST /rider/tickets` |
| Language button | `PATCH /rider/profile` with `language` |

## Flow

1. **Login (rider only):** `POST /rider/auth/otp/send`, then `POST /rider/auth/otp/verify` with `{ "phone": "9876543210", "otp": "123456" }`. No `role` is needed: the account is always a rider. Keep `accessToken` and `refreshToken`; use `POST /rider/auth/refresh`, `POST /rider/auth/logout` and `GET /rider/auth/me` after that. The shared `/auth/*` and `/app/auth/*` logins still work.
2. **Licence question:** `PUT /rider/onboarding/license` with `{ "hasLicense": true }`.
   - `true` returns modes `ride` and `transport` ("Get Bike Taxi + Delivery Orders").
   - `false` returns mode `transport` only ("Only Delivery Orders"). The licence step is skipped and ride services are refused later.
   - The response lists the services the rider may choose.
3. **Vehicle and services:** `GET /rider/onboarding/options` gives `licenseChoices`, `vehicleTypes` and `services`. Then `POST /rider/onboarding` with `{ "type": "individual", "vehicleTypeId": "...", "services": ["bike", "bike_porter"] }`. For a fleet rider use `"type": "partner"` plus `partnerCode`.
4. **Driving licence:** multipart `POST /rider/documents` with `docType=driving_license`, `docNumber`, `file` (front) and `backFile` (back). The back is mandatory, even if blank. Expiry date is not needed.
5. **Photo and name:** multipart `PATCH /rider/profile` with `name`, `dateOfBirth` (`1998-07-30`), `gender` (`male`, `female`) and `photo`. Riders must be 18 or older.
6. **Vehicle number:** `POST /rider/vehicle` with `registrationNumber`. Optionally multipart `rcFront` and `rcBack` (marked "Not Compulsory" in the app). Vehicle type and category come from step 3. Sending it again before approval corrects the number (200). A number already used by another vehicle returns 409.
7. **ID proof:** `POST /rider/documents` with `docType=aadhaar` (`file` front, `backFile` optional) or `docType=pan` (`file` only), plus `docNumber`. One of the two is enough.
8. **Verification screen:** `GET /rider/onboarding/status` (poll it, or refetch when the app opens).
9. **After approval:** `POST /rider/selfie-check`, then `POST /rider/duty/online`.

## Number formats (checked by the server)

| Document | Format | Example |
|---|---|---|
| Driving licence | 2 letters, 2 digits, then 9 to 13 letters or digits. Spaces and hyphens are removed | `MP09 2023 0022590`, `KA12345677899029` |
| Aadhaar | 12 digits | `1234 5677 8990` |
| PAN | 5 letters, 4 digits, 1 letter | `KAMPS4180M` |
| Vehicle | State code, district, series, number | `MP09AB1234` |

A wrong format returns `400` with a message to show under the field ("Check DL number before you submit").

## New and changed endpoints

### PUT /rider/onboarding/license
Body `{ "hasLicense": true }`. Response:
```json
{ "hasLicense": false, "modes": ["transport"], "services": [ { "key": "bike_porter", "mode": "transport", "name": "Bike Porter", "icon": "package" } ] }
```
`409` once the account is approved.

### GET /rider/onboarding/status
```json
{
  "status": "under_review",
  "title": "Documents under verification",
  "message": "This may take up to 24 hours. Please wait!",
  "items": [
    { "key": "vehicle", "title": "Vehicle - Bike", "status": "selected" },
    { "key": "driving_license", "title": "Driving License", "status": "verified" },
    { "key": "photo_name", "title": "Photo and name", "status": "verified" },
    { "key": "vehicle_number", "title": "Vehicle Number", "status": "under_review" },
    { "key": "identity", "title": "Aadhaar or PAN card", "status": "under_review" }
  ],
  "nextStep": null,
  "hasLicense": true
}
```
- Item `status`: `not_submitted`, `selected` (vehicle row only), `under_review`, `verified`, `rejected` (a `reason` is added).
- Top-level `status`: `pending` (something still to submit or fix, `nextStep` names the first item), `under_review` (everything submitted), `approved`, `rejected`.
- The `driving_license` row is absent when the rider chose "No".
- "Photo and name" shows `verified` as soon as name, photo, date of birth and gender are saved. It has no admin review.
- Documents and the vehicle become `verified` when an admin approves them in the admin panel (Fleet → Documents, Fleet → Vehicles).

### POST /rider/documents (changed)
Multipart: `docType`, `docNumber`, `file`, optional `backFile`, `expiryDate`.
- `backFile` is required for `driving_license`, optional for `vehicle_rc` and `aadhaar`, and refused for other types.
- Driving licence no longer asks for an expiry date. Insurance, PUC and permit still do.
- Re-uploading a type replaces it and sends it back for review.
- `GET /rider/documents` now lists `driving_license` and `aadhaar_or_pan` as required. RC and insurance are optional.
- Document records now carry `backUrl` next to `fileUrl`.

### POST /rider/vehicle (changed)
JSON or multipart. Only `registrationNumber` is required after onboarding. `vehicleTypeId`, `categoryKey`, `model` and `manufacturer` are optional overrides. `rcFront` and `rcBack` are saved as the `vehicle_rc` document.

### PATCH /rider/profile (changed rule)
For riders, `profileComplete` is now true when name, photo, date of birth and gender are set. The emergency contact is no longer needed for riders. Customers still need it.

## Not built

- **Permissions (optional)** row on the verification screen: location and notification permission are device settings, so there is no server state for them.
- **Reading numbers from photos:** the app screens show the number filled in after upload. The server does not read card images. The app must read it on the device or the rider types it.
- **Driving licence and ID checks with a government service** are not integrated. An admin has to verify the uploads.
- **Admin panel:** the Documents page does not show the uploaded images yet (front `fileUrl` or back `backUrl`), so an admin cannot review a licence from there. The files are served at `/uploads/...`.
