# Deployment: Hostinger (Business / Cloud hosting)

The pipeline is `.github/workflows/ci-cd.yml`. It is **off until you turn it on**: until then every push only runs the checks.

| Part | Built by | Goes to | Hostinger side |
|---|---|---|---|
| Admin panel (repo root) | GitHub Actions | `public_html` of e.g. `admin.example.com`, over SSH (rsync) | Plain static site |
| Website (`website/`) | GitHub Actions | `public_html` of e.g. `example.com`, over SSH (rsync) | Plain static site |
| API (`server/`) | GitHub Actions | `deploy/api` branch of this repo (compiled JS, no TypeScript) | Node.js web app connected to that branch |

**When it runs**

- Every push to any branch, and every pull request into `main`: lint and build all three parts (job `Lint and build`). Nothing is deployed.
- Push or merge to `main`, or **Actions → CI/CD → Run workflow** on `main`: the checks, then the three deploy jobs, if the repository variable `DEPLOY_ENABLED` is `true`. A deploy job only starts after the checks pass.

Both front ends ship an `.htaccess` (from `public/.htaccess` and `website/public/.htaccess`) that forces HTTPS and sends deep links such as `/users/customers` or `/drive` to `index.html`.

## One-time setup

Replace `example.com` below with your domain.

### 1. Domains

In hPanel add the website domain and two subdomains, e.g. `example.com` (website), `admin.example.com` (admin panel) and `api.example.com` (API). Turn on SSL for each.

Note each static site's folder relative to your home directory, shown in hPanel under the domain's or subdomain's settings, usually `domains/example.com/public_html` (website) and the subdomain's own `public_html` folder (admin panel). The pipeline **replaces the whole contents** of these folders on each deploy (except `.well-known/`), so do not point them at a folder that holds anything else.

### 2. SSH access for GitHub Actions

1. hPanel → **Advanced → SSH Access**: enable SSH and note the **IP**, **port** (Hostinger uses `65002`) and **username** (`u123456789`).
2. On your computer, create a key used only for deploys (no passphrase):
   ```
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f anzcabs_deploy -N ""
   ```
3. hPanel → SSH Access → **SSH keys** → add the contents of `anzcabs_deploy.pub`.
4. Check it works: `ssh -i anzcabs_deploy -p 65002 u123456789@<ip> "ls domains"`.
5. The private key file `anzcabs_deploy` goes into the GitHub secret `HOSTINGER_SSH_KEY` (step 4). Delete your local copy afterwards if you don't need it.

### 3. API as a Node.js web app

The `deploy/api` branch appears after the first deploy run. To create it before setting up Hostinger, do step 4 with `DEPLOY_ENABLED=true` and run the workflow once: the API job will succeed, the front-end jobs will fail until SSH is set up, and that is fine.

1. hPanel → **Websites → Add website → Node.js app** (Business and Cloud plans), choose **Import Git repository**, connect GitHub and pick this repository and the branch **`deploy/api`**. Attach it to `api.example.com`.
2. Build settings (field names may differ slightly in hPanel):
   - Node.js version: **22** (20 also works)
   - Root directory: `/` (the branch holds only the API)
   - Install / build command: `npm ci --omit=dev` (the code is already compiled; `npm run build` just prints a message)
   - Start command: `npm start` (entry file `dist/server.js`)
3. Environment variables (hPanel → the app → Environment variables). Never commit these.

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | Atlas connection string with database `rideflow_admin` |
   | `CORS_ORIGIN` | `https://admin.example.com,https://example.com` |
   | `PUBLIC_BASE_URL` | `https://api.example.com` |
   | `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_APP_ACCESS_SECRET`, `JWT_APP_REFRESH_SECRET`, `OTP_SECRET` | Each a different random value of 32+ characters (see below) |
   | `TRUST_PROXY` | `1` |
   | `DB_POOL_SIZE` | `10` on the Atlas free tier |
   | `UPLOAD_DIR` | A folder **outside** the app folder, e.g. `/home/u123456789/anzcabs-uploads`, so uploaded documents survive redeploys |
   | `OTP_DEV_ECHO` | `false` |
   | `SMS_PROVIDER`, `PAYMENT_PROVIDER`, `PUSH_PROVIDER`, `TELEPHONY_PROVIDER` and their keys | See `server/.env.example`. `FIREBASE_*_SERVICE_ACCOUNT` can hold the JSON itself on one line |
   | `GOOGLE_MAPS_API_KEY`, `RIDER_APP_URL` | As in `server/.env.example` |

   Do not set `PORT`; Hostinger sets it. Generate a secret with:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   In production the server refuses to start with weak or equal JWT secrets or without `CORS_ORIGIN`; the reason is in the app's logs.
4. Turn on **automatic deployment on push** for the app if hPanel offers it. Otherwise press **Redeploy** in hPanel after each pipeline run.
5. MongoDB Atlas → **Network Access**: add the Hostinger server's IP (shown in hPanel). If connections still fail, Hostinger's outgoing IP may differ; check the app logs for the Atlas "IP isn't whitelisted" error.
6. Check: `https://api.example.com/health/ready` returns `{"status":"ready","db":"up",...}`.

### 4. GitHub settings

Repository → **Settings → Secrets and variables → Actions**.

**Secrets**

| Name | Value |
|---|---|
| `HOSTINGER_SSH_KEY` | Private key from step 2 (the whole file, including the `BEGIN`/`END` lines) |
| `GOOGLE_MAPS_BROWSER_KEY` | Google Maps JavaScript API key for the admin Live Tracking map. Restrict it to `https://admin.example.com/*` in Google Cloud, since it ends up in the browser |

**Variables**

| Name | Example |
|---|---|
| `DEPLOY_ENABLED` | `true` (anything else keeps deploys off) |
| `API_PUBLIC_URL` | `https://api.example.com` (no trailing slash; the jobs add `/api/v1/admin` or `/api/v1`) |
| `HOSTINGER_SSH_HOST` | SSH IP from step 2 |
| `HOSTINGER_SSH_PORT` | `65002` (used when empty) |
| `HOSTINGER_SSH_USER` | `u123456789` |
| `ADMIN_REMOTE_PATH` | Admin subdomain folder from step 1, relative to home |
| `WEBSITE_REMOTE_PATH` | `domains/example.com/public_html` |

A missing secret or variable fails the deploy job with a message naming it.

## Day to day

- **Deploy**: merge or push to `main`. Follow it under **Actions → CI/CD**.
- **Redeploy the same code**: Actions → CI/CD → **Run workflow** on `main`.
- **Roll back**: open an older successful run of `main` in Actions and choose **Re-run all jobs**. It rebuilds and deploys that run's commit, including the API branch.
- **Pause deploys**: set `DEPLOY_ENABLED` to `false`. Checks keep running.
- Do not edit the `deploy/api` branch; each deploy overwrites it.

## Limits of shared / Cloud hosting

- **One API process.** Socket.IO rooms, live rider positions, dispatch timers and rate limits live in memory (see [LOAD_AND_SCALING.md](LOAD_AND_SCALING.md)), so the API must not run as several instances.
- **Socket.IO** falls back to HTTP long-polling if the plan's proxy does not pass WebSockets. It works, with more latency and load. For the rider and customer apps at real traffic, a Hostinger VPS (PM2 + nginx) is the better home for the API; the front-end deploy stays the same.
- **Uploads** live on the server's disk (`UPLOAD_DIR`). Back that folder up, or move uploads to object storage before scaling.
