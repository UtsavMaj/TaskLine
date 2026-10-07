# Deployment

The suggested setup uses free tiers only:

| Piece      | Where                              | Notes                                         |
| ---------- | ---------------------------------- | --------------------------------------------- |
| PostgreSQL | Render Postgres or Neon            | any PostgreSQL 14+ works                      |
| API        | Render (Docker)                    | `render.yaml` blueprint included              |
| Web        | Vercel                             | `web/vercel.json` proxies `/api` to the API   |
| Android    | EAS Build (Expo)                   | produces an installable `.apk`                |

Railway, Fly.io, Netlify or any VPS work too. The API is a normal Docker image and the web app is static files.

---

## 1. Database + API on Render

**With the blueprint (easiest)**

1. Push the repository to GitHub.
2. In Render: **New → Blueprint**, then select the repo. Render reads `render.yaml` and creates `taskline-db` (PostgreSQL) and `taskline-api` (Docker web service).
3. When asked for `CORS_ORIGINS`, enter the web URL you'll get in step 2 (for example `https://taskline.vercel.app`). You can fill it in later under *Environment*.
4. Deploy. On every start the container runs `prisma migrate deploy` before the server, so the tables are created automatically.
5. Check `https://<your-api>.onrender.com/api/health`. It should return `{"status":"ok"}`.

**Manually**: New → Web Service → this repo, *Runtime: Docker*, *Dockerfile path* `backend/Dockerfile`, *Docker build context* `.`, health check path `/api/health`. Then add the environment variables below.

| Variable            | Value                                                                  |
| ------------------- | ---------------------------------------------------------------------- |
| `NODE_ENV`          | `production`                                                           |
| `DATABASE_URL`      | the database's internal connection string                             |
| `JWT_ACCESS_SECRET` | 48+ random characters (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) |
| `CORS_ORIGINS`      | your web URL, no trailing slash                                        |
| `COOKIE_SAMESITE`   | `lax` when the web app proxies `/api` (default setup below), `none` if the browser calls the API domain directly |
| `TRUST_PROXY`       | `1`                                                                    |

**Optional: load the demo data** into the production database from your machine:

```bash
cd backend
DATABASE_URL="<external connection string>" npm run db:seed
```

> Free Render services go to sleep after 15 minutes without traffic, and the first request can then take up to a minute. Open `/api/health` before a demo to wake the service up.

## 2. Web app on Vercel

1. Edit `web/vercel.json` and replace `YOUR-BACKEND-HOST` with your API host, for example:
   ```json
   { "source": "/api/:path*", "destination": "https://taskline-api.onrender.com/api/:path*" }
   ```
   With this rewrite, the browser only ever talks to the Vercel domain. The refresh-token cookie is then first-party, which works in every browser, including Safari with tracking prevention.
2. In Vercel: **Add New → Project**, import the repo, and set:
   - **Root Directory:** `web`
   - Framework preset: **Vite** (build `npm run build`, output `dist`)
   - Leave `VITE_API_URL` **empty** (requests go to `/api` on the same domain).
3. Deploy, then put the resulting URL into the API's `CORS_ORIGINS`.

**Calling the API directly instead of proxying:** set `VITE_API_URL=https://<your-api>` in Vercel, set `COOKIE_SAMESITE=none` on the API, and keep the web URL in `CORS_ORIGINS`. Some browsers block third-party cookies, so the proxy setup above is preferred.

## 3. Android app (APK) with EAS Build

Requirements: a free Expo account and `npm i -g eas-cli` (or use `npx eas-cli@latest`).

1. In `mobile/eas.json`, replace `https://YOUR-BACKEND-HOST` (profile `preview`) with your API URL, **without** `/api`.
2. Build:
   ```bash
   cd mobile
   eas login
   eas init                     # first time only: links the project to your Expo account
   eas build -p android --profile preview
   ```
3. When the build finishes, EAS prints a link and a QR code to download the `.apk`. Open it on an Android phone (allow "install unknown apps") or share the link. That link can be submitted as the mobile deliverable.

The `preview` profile builds a standalone APK (`buildType: apk`), so no Play Store is needed.

## 4. Running the mobile app against the deployed backend (no build)

For a quick check with **Expo Go** on a real phone:

```bash
cd mobile
echo EXPO_PUBLIC_API_URL=https://taskline-api.onrender.com > .env
npx expo start
```

Scan the QR code with Expo Go (Android). The app uses the deployed API, so signing in with the account you made on the web shows the same projects and tasks.

> Everything works in Expo Go except the optional "due tomorrow" reminders: Expo Go on Android no longer ships notification support (SDK 53+), so that switch is disabled there. The APK from step 3 includes it.

## 5. Everything with Docker (one machine)

```bash
docker compose up --build
```

- Web: http://localhost:8080 (Nginx serves the build and proxies `/api`)
- API: http://localhost:4000/api
- PostgreSQL: localhost:5432

Load the demo data with `docker compose exec api npx prisma db seed`. Point the mobile app at `http://<your-computer's-LAN-IP>:4000` to use this stack from a phone.

## Checklist for the demo recording

1. Open the web URL, register (or use `demo@taskline.dev` / `Demo@1234` if seeded).
2. On the phone, sign in with the **same** account.
3. Create a task on the web, then pull to refresh on the phone: the task appears.
4. Mark it completed on the phone, then switch back to the browser tab (it refetches on focus): it shows as done, and the dashboard numbers update on both.
