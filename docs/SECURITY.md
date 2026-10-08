# AnZ Cabs API: tokens and security

## Tokens

| Token | Who | Lifetime | Secret (`server/.env`) | Audience |
|---|---|---|---|---|
| Admin access | Admin panel | 15 min (`ACCESS_TOKEN_TTL_MINUTES`) | `JWT_ACCESS_SECRET` | `admin:access` |
| Admin refresh | Admin panel | 7 days (`REFRESH_TOKEN_TTL_DAYS`) | `JWT_REFRESH_SECRET` | `admin:refresh` |
| Admin login OTP step | Admin panel | 10 min | `JWT_ACCESS_SECRET` | `admin:otp-challenge` |
| App access | Customer and rider apps | 60 min (`APP_ACCESS_TOKEN_TTL_MINUTES`) | `JWT_APP_ACCESS_SECRET` | `app:access` |
| App refresh | Customer and rider apps | 30 days (`APP_REFRESH_TOKEN_TTL_DAYS`) | `JWT_APP_REFRESH_SECRET` | `app:refresh` |
| App sign-up step | New phone number | 30 min | `JWT_APP_ACCESS_SECRET` | `app:registration` |
| Invoice link | Shared invoice URL | 7 days | `JWT_APP_ACCESS_SECRET` | `public:invoice` |

Every token:
- is signed HS256 and checked with that algorithm only (a token with `alg: none` or another algorithm is refused);
- has issuer `anzcabs-api`, an audience for its purpose, a unique `jti` and an expiry;
- is refused if its audience or `type` does not match, so an admin token does not work on app APIs, an app token does not work on admin APIs, and a refresh token does not work as an access token.

Session tokens also carry a session id (`fid`).

## Refresh tokens and sessions

- **Refresh tokens are single use.** `POST /admin/auth/refresh`, `POST /rider/auth/refresh` and `POST /app/auth/refresh` return a new access and refresh pair. The client must store the new refresh token.
- **Replay detection.** If an already-used refresh token is sent again, it was copied. The whole login session is revoked: that refresh token, the newer one and every access token of the session stop working, and the user must sign in again.
- **Logout ends the session.** Admin logout (`POST /admin/auth/logout`) and app logout (`POST /rider/auth/logout`, `/app/auth/logout`) revoke the session, so the access token stops working at once instead of at its expiry. Send `refreshToken` in the app logout body.
- **Every request checks the account.** A suspended admin or user is refused immediately, and admin roles and permissions are read fresh on each call, so a role change applies at once.
- Revocation records live in the `revokedtokens` collection and are removed automatically after they expire. Socket.IO connections use the same checks.

Changing any token setting (such as audience) invalidates existing tokens: everyone signs in again once.

## Other protections on `/api`

- Request body, query and path values with `$` operators, dotted names or `__proto__` are refused (NoSQL injection, prototype pollution). Query values must be a single text value.
- 1000 requests per IP per 15 minutes (`RATE_LIMIT_MAX`). Admin login: 10 failed attempts per IP and 10 per email per 15 minutes. OTP send and verify have their own limits.
- JSON body limit 100 KB (413 when larger). `Cache-Control: no-store` on API responses. Helmet security headers.
- Uploads are limited to JPEG, PNG, WebP and PDF, 5 MB, and the file's first bytes must match its type.
- Search text is escaped before it is used as a regular expression.
- In production the server will not start with a default or short JWT secret, with the access and refresh secrets equal, or without `CORS_ORIGIN`. Set `TRUST_PROXY` to the number of proxies in front of the server so rate limits see real IP addresses.
- Input is validated with zod for admin sign-in, admin users, pricing, commissions and wallet adjustments. Other admin endpoints still use hand-written checks.

## Known gaps

- New admins are created with the shared `SEED_ADMIN_PASSWORD`. They should set their own password on first login.
- The admin panel keeps the refresh token in the browser's local storage, which a cross-site scripting bug could read. An httpOnly cookie is safer.
- Rate limits are kept in server memory: they reset on restart and are not shared between servers. Use a Redis store when running more than one server.
- Uploaded documents under `/uploads` can be opened without signing in by anyone who has the (random) link.
- App access tokens last 60 minutes. Lower `APP_ACCESS_TOKEN_TTL_MINUTES` (for example 15) once the Flutter apps refresh reliably.
