# AnZ Cabs API: load handling and scaling

## What protects the server

| Protection | What it does | Setting (`server/.env`) |
|---|---|---|
| Overload guard | When too many requests are running at once, or the server falls behind, new requests get `503` + `Retry-After: 3` straight away instead of queueing until everything times out | `MAX_CONCURRENT_REQUESTS` (250), `MAX_EVENT_LOOP_LAG_MS` (250) |
| Request timeout | A request running longer than 30 s is answered with `503` | `REQUEST_TIMEOUT_MS` |
| Per-user limit | A signed-in customer or rider can make 240 requests a minute (`429` after that). Other users are not affected | `APP_USER_RATE_LIMIT` |
| Per-IP limit | 5000 requests per IP per 15 minutes. High on purpose: many phones share one mobile-network IP | `RATE_LIMIT_MAX` |
| Cache | Platform settings (5 s), service areas (15 s), pricing and commission rules (10 s, cleared at once when an admin edits them), rider counts and ETAs per ~100 m area (10 s). A burst of identical requests runs one database query | none |
| Database | Connection pool of 50, 5 s to find the database, 45 s socket timeout, new indexes for the busiest queries (nearby riders, booking offers, vehicles, documents, wallet history) | `DB_POOL_SIZE` |
| Nearby riders | Searches only riders inside a lat/lng box around the pickup, using an index, instead of every online rider | none |
| Socket.IO | 100 KB message limit, rider location accepted at most once a second per rider, chat limited to 2 messages a second, rider status and active trip cached for 5 s per connection | none |
| Crash handling | An unhandled promise rejection is logged and the server keeps running. An uncaught exception logs, finishes running requests and exits so a process manager starts a fresh server | none |
| Graceful shutdown | On SIGTERM / SIGINT the server stops taking new connections, closes idle ones, finishes running requests (up to 10 s), then closes the database | none |
| Restart recovery | The dispatch sweeper (already present) re-offers bookings whose rider offer timer was lost in a restart | none |
| Health checks | `GET /health` (alive) and `GET /health/ready` (database up, shows in-flight requests and event-loop lag; `503` when the database is down) | none |

## Measured on the development laptop

One Node process, production build (`node dist/server.js`), local MongoDB, load generator on the same machine, 50 customers calling a mix of Home, All Services, fare estimate, place search, referral and services:

| Clients at once | Requests/s | Result |
|---|---|---|
| 40 | about 124 | all 200, median 280 ms, slowest 880 ms |
| 100 | about 101 | 96% 200, 4% 503 |
| 500 (spike) | about 115 | 82% 200, 18% 503, no crash, normal again right after |
| 500 with `MAX_CONCURRENT_REQUESTS=250` | answers faster but turns most requests away | 729 served, 5646 sent `503`, no crash |

Other numbers: the fare estimate went from about 200 ms to about 22 ms for one request (rules cached, categories priced in parallel). Each request costs about 10 ms of CPU, so one process serves roughly 100 requests a second on this machine. A laptop with other programs open is not a server; expect more on real hardware, but measure it there.

A real app does not hammer the server in a tight loop: the 500-client test sends requests back to back, which is harsher than 500 phones. The app should retry a `503` after the `Retry-After` seconds.

## Before you expect thousands of users

1. **Run it as a built app under a process manager**, not `npm run dev`: `npm run build`, then `NODE_ENV=production pm2 start dist/server.js` (or systemd or Docker with a restart policy). The server exits on a fatal error on purpose; the manager restarts it.
2. **Put nginx or a cloud load balancer in front** and set `TRUST_PROXY=1`. It handles TLS and slow clients, and its idle timeout is under the server's 65 s keep-alive.
3. **One server process only, for now.** Several processes (PM2 cluster, several machines) would break these, because they live in each process's memory: Socket.IO rooms, live rider positions, dispatch offer timers, rate limits and the caches. Before scaling out, move them to Redis (the Socket.IO Redis adapter, a Redis rate-limit store, offers re-scheduled from the database) and use sticky sessions for sockets.
4. **MongoDB:** use a replica set (backups, failover), a server with enough memory for the working set, and check slow queries with the profiler once real traffic arrives.
5. **Uploads** are stored on the server's disk. Move them to S3 or similar before running more than one server, and watch disk space.
6. **Turn on a monitor** (UptimeRobot, CloudWatch, Grafana) that calls `/health/ready` and alerts on `503` or a rising `eventLoopLagMs`.

## Known limits

- Rate limits and caches are per process and reset on restart.
- A change to service areas applies within 15 seconds; settings within 5 seconds (settings saved from the admin panel apply at once).
- Rider location updates still write to the database every few seconds per online rider. With thousands of riders online at once, store live positions in Redis instead.
- Admin list endpoints are paged, but the booking report reads up to 1000 rows at once. Watch reports under heavy admin use.
