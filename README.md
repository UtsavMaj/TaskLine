# Taskline

A project and task manager with a **React web app** and an **Android app (Expo / React Native)**. Both apps use the **same Express + PostgreSQL API**, so one account works on both, and a task created on one appears on the other after a refresh.

| | |
| --- | --- |
| **Backend** | Node.js 20+, Express 5, Prisma ORM, PostgreSQL, Zod, JWT + rotating refresh tokens, bcrypt, Pino logging |
| **Web** | React 19, Vite, React Router, TanStack Query, React Hook Form, CSS Modules |
| **Mobile** | Expo SDK 57 (React Native 0.86), Expo Router, expo-secure-store, NetInfo, TanStack Query (persisted for offline viewing) |
| **Shared** | `packages/shared`: Zod schemas, enums and API types used by all three apps |

Live links (fill in after deploying, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)):

- Web app: `https://…`
- API: `https://…/api/health`
- Android APK: `https://expo.dev/…`
- Interactive API docs: `https://…/api/docs`

| Web (dashboard) | Mobile (project) |
| --- | --- |
| ![Web dashboard](docs/screenshots/web-dashboard.png) | <img src="docs/screenshots/mobile-project.png" alt="Mobile project screen" width="260"> |

More screenshots are [below](#screenshots).

---

## Features

**Required**

- Register, log in and log out on web and mobile with the same account
- Projects: create, view, edit, delete, list. Each has a name, description, status, start/end date and created date
- Tasks inside projects: create, edit, delete, mark completed. Each has a priority, status, due date and created date
- Dashboard: total projects, total tasks, completed tasks, pending tasks, projects in progress (plus in-progress tasks, overdue tasks, completion rate and what's due next)
- Search projects and tasks by name. Filter projects by status, and tasks by status and priority
- Mobile: dashboard, projects, tasks per project, task create/edit/delete/complete, search and filters, pull-to-refresh, token in the Android Keystore, a clear message when the session expires or there is no network

**Bonus features included**

- Refresh tokens with rotation and reuse detection; logout revokes the session at once
- Pagination and sorting on every list
- Audit log (Activity page on web)
- Role-based access control (`ADMIN`-only `/api/admin/users`)
- Validation shared between web, mobile and backend (one set of Zod schemas)
- Offline viewing on mobile (last loaded data is kept on the device)
- **Push notifications for tasks due tomorrow**: the phone registers its Expo push token, and the backend sends one push at 6 pm *in the phone's time zone* listing open tasks due the next day (opt-in, cleaned up on sign-out)
- Interactive API docs (Swagger UI at `/api/docs`, generated from the same Zod schemas the API validates with)
- Unit and integration tests (122 tests across shared, backend and web)
- Docker (`docker compose up`)
- CI/CD with GitHub Actions: tests + Docker builds on every push, deploy to Render only when they pass, a reminder job every 30 minutes, and a one-click Android APK build

## Repository layout

```
taskline/
├── backend/            Express API
│   ├── prisma/         schema.prisma, SQL migrations, seed
│   ├── src/
│   │   ├── config/     env validation
│   │   ├── lib/        prisma client, logger, tokens, password, serializers, audit
│   │   ├── middleware/ authenticate, requireRole, validate, rate limits, error handler
│   │   ├── modules/    auth, projects, tasks, dashboard, audit, admin, notifications (routes → controller → service)
│   │   ├── docs/       OpenAPI spec served at /api/docs
│   │   └── routes/     /api router
│   └── tests/          integration tests against a real PostgreSQL database
├── web/                React app (Vite)
│   └── src/            api/, auth/, components/, hooks/, pages/, styles/
├── mobile/             Expo app
│   └── src/            app/ (Expo Router screens), components/, lib/
├── packages/shared/    Zod schemas + types used by all three
├── docs/               API.md, DATABASE.md (ER diagram), DEPLOYMENT.md
├── docker-compose.yml
└── render.yaml         Render blueprint (API + PostgreSQL)
```

## Getting started (local)

Prerequisites: **Node.js 20.19+** (22 LTS recommended), **npm 10+**, and **PostgreSQL** (local install or `docker compose up -d db`). For the phone app, install **Expo Go** on an Android device, or use an Android emulator.

```bash
# 1. install everything (npm workspaces, one install for all apps)
npm install

# 2. database + API
docker compose up -d db                 # or use your own PostgreSQL
cp backend/.env.example backend/.env    # edit DATABASE_URL / JWT_ACCESS_SECRET if needed
npm run db:migrate                      # creates the tables
npm run db:seed                         # optional demo data
npm run dev:api                         # http://localhost:4000/api

# 3. web app (new terminal)
npm run dev:web                         # http://localhost:5173

# 4. mobile app (new terminal)
npm run dev:mobile                      # scan the QR code with Expo Go
```

Demo accounts after seeding (test data only): `demo@taskline.dev` / `Demo@1234`, and `admin@taskline.dev` / `Admin@1234`.

**Pointing the phone at your computer:** in development the app automatically calls port 4000 on the machine running Metro, so a phone on the same Wi-Fi works with no setup. To use a different backend, create `mobile/.env` with `EXPO_PUBLIC_API_URL=https://your-api` (or `http://10.0.2.2:4000` for the Android emulator). If your phone can't connect, allow Node.js through the Windows firewall for port 4000.

### Useful scripts (from the repo root)

| Command | |
| --- | --- |
| `npm run dev:api` / `dev:web` / `dev:mobile` | start one app |
| `npm test` | all test suites (the backend needs a PostgreSQL test database, see below) |
| `npm run typecheck` | TypeScript across shared, backend, web, mobile |
| `npm run build` | production build of API (`backend/dist`) and web (`web/dist`) |
| `npm run db:migrate` / `db:seed` | database migrations / demo data |

## Environment variables

### Backend (`backend/.env`)

Every variable is validated at startup ([`src/config/env.ts`](backend/src/config/env.ts)). The server refuses to start with a clear message if one is missing or invalid.

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `PORT` | `4000` | HTTP port |
| `DATABASE_URL` | – (required) | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | – (required, ≥ 32 chars) | HS256 signing secret for access tokens |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | session / refresh token lifetime (extended on use) |
| `CORS_ORIGINS` | `http://localhost:5173` | comma-separated browser origins allowed to call the API |
| `COOKIE_SAMESITE` | `lax` | `lax` if web and API share a site (proxy), `none` if they're on different domains |
| `COOKIE_SECURE` | `true` in production | send the refresh cookie over HTTPS only |
| `TRUST_PROXY` | `0` | number of reverse proxies in front of the API (Render/Railway/Nginx: `1`) |
| `BCRYPT_ROUNDS` | `12` | bcrypt cost factor |
| `AUTH_RATE_LIMIT_MAX` | `10` | failed logins allowed per IP per window |
| `AUTH_RATE_LIMIT_WINDOW_MINUTES` | `15` | rate-limit window for auth routes |
| `API_RATE_LIMIT_MAX` | `300` | requests per IP per minute for all API routes |
| `LOG_LEVEL` | `info` | `fatal` … `trace`, or `silent` |
| `REMINDER_HOUR` | `18` | local hour (in each phone's time zone) when "due tomorrow" pushes go out |
| `REMINDER_SCHEDULER` | `true` | check for due reminders every 15 min inside the API process |
| `CRON_SECRET` | – (endpoint off) | enables `POST /api/jobs/due-reminders` for an external cron (header `x-cron-secret`) |
| `EXPO_ACCESS_TOKEN` | – | only if "enhanced push security" is turned on in your Expo project |

### Web (`web/.env`)

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | API origin **without** `/api`. Leave empty when `/api` is served from the same domain (Vite dev proxy, `vercel.json` rewrite, Nginx). |
| `VITE_DEV_API_TARGET` | dev only: where the Vite proxy forwards `/api` (default `http://localhost:4000`) |

### Mobile (`mobile/.env` or `eas.json` → `env`)

| Variable | Description |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | API origin without `/api`, e.g. `https://taskline-api.onrender.com`. Optional in development (falls back to the Metro host on port 4000). |

## Documentation

- **[API reference](docs/API.md)**: every endpoint, parameters, responses and error codes
- **Swagger UI** at `/api/docs` (raw spec at `/api/openapi.json`): try every endpoint from the browser
- **[Database](docs/DATABASE.md)**: ER diagram, constraints, setup and seed. The full schema as plain SQL is in [docs/schema.sql](docs/schema.sql)
- **[Deployment](docs/DEPLOYMENT.md)**: Render + Vercel + EAS (APK), and running the mobile app against the deployed backend

## How it works

### One backend, two clients

```
 React web (Vercel) ──┐   /api (same-origin via rewrite)
                      ├──▶ Express API ──▶ PostgreSQL
 Android app (Expo) ──┘   https://api…/api
```

Both apps call the same REST endpoints with the same JSON. They also share the same Zod schemas from `packages/shared`, so a field that's invalid in the web form is invalid in the mobile form and rejected by the API with the same message.

### Authentication and sessions

- Passwords are hashed with **bcrypt** (cost 12) and never returned. Responses are built field by field (`lib/serializers.ts`), so `password_hash` can't leak.
- Login creates a **session** row and returns a short-lived **JWT access token** (15 min) plus a **refresh token** (`<sessionId>.<random secret>`; only its SHA-256 is stored).
- **Web:** the access token stays in memory only. The refresh token is an `httpOnly` cookie scoped to `/api/auth`, so JavaScript (and therefore XSS) can't read it. On page load the app calls `/auth/refresh` to restore the session.
- **Mobile:** the refresh token is stored with **expo-secure-store**, which uses the **Android Keystore** (Keychain on iOS). Nothing token-related goes to AsyncStorage.
- When a request gets `401`, the client refreshes once and retries. If the refresh fails, the user is sent to the login screen with *"Your session has expired. Please sign in again."*
- Refresh tokens **rotate** on every use. Re-using an old one revokes the session (theft detection). **Logout** revokes the session server-side, and the access token stops working on the next request.

### Authorization

Every query is scoped to the signed-in user: `projects.user_id = me`, and for tasks, `task.project.user_id = me`. Asking for someone else's project or task returns **404**, exactly like a missing record, so ids can't be probed. Creating a task in, or moving one into, another user's project is also a 404. The integration tests cover every one of these cases.

### Validation and errors

- Every body and query string is parsed by Zod before the controller runs. Data is trimmed, unknown keys are dropped (no mass assignment), enums, dates (real calendar days) and lengths are checked, and the response is `400` with one message per field.
- One error handler turns everything into `{ error: { code, message, details?, requestId } }`. Stack traces and SQL errors only go to the logs.

### Security checklist

| Requirement | Implementation |
| --- | --- |
| Password hashing | bcrypt, cost 12, 72-byte limit enforced |
| JWT auth + middleware + protected routes | `middleware/authenticate.ts`, pinned to HS256 with issuer/audience checks |
| Users only see their own data | ownership in every `where`, 404 for foreign ids, tested |
| Input validation | shared Zod schemas, `middleware/validate.ts` |
| No sensitive data in responses | explicit serializers, no password/token hashes ever returned |
| SQL injection | Prisma parameterised queries only; there's a test that searches for `' OR 1=1; DROP TABLE…` |
| Rate limiting | `express-rate-limit`: 10 failed logins / 15 min / IP, plus limits on register/refresh and globally |
| CORS | allow-list from `CORS_ORIGINS`, credentials enabled only for those origins |
| Other | Helmet headers, 100 kB body limit, CSRF guard on the cookie endpoint, request ids, log redaction of tokens/passwords/cookies |

### Logging

HTTP requests are logged with **pino-http** (method, URL, status, duration, request id). Authorization headers, cookies, passwords and tokens are redacted. Development output is pretty-printed; production writes JSON lines.

### Mobile specifics

- **Navigation:** Expo Router with `Stack.Protected`. Signed-out users can only reach `(auth)`, signed-in users only `(app)`, so an expired session lands on the login screen wherever the user was.
- **Pull-to-refresh** on the dashboard, project list, project tasks and all-tasks list. Lists load more pages as you scroll.
- **No network:** NetInfo drives an offline banner. Requests fail fast with a friendly message and a *Try again* button instead of a blank screen. The last loaded data stays visible because the query cache is persisted to the device.
- **Push reminders (optional):** turning on *Tasks due tomorrow* in the Account tab registers the phone's Expo push token with the API (`POST /api/push-tokens`, with the phone's time zone). The backend job (`modules/notifications`) runs every 15 minutes or from a cron. Once it's 6 pm on a phone, it sends that phone one push listing the user's open tasks due tomorrow. Tapping the push opens the task list. Each device is "claimed" for the day with a conditional update, so overlapping runs never send twice. Tokens Expo reports as dead are deleted, and tokens are tied to the session, so signing out stops reminders. If no EAS project id is configured yet, the app falls back to scheduling the same notification on the phone. Notifications need the installed APK: Expo Go on Android doesn't include them, so the switch is disabled there.

## Tests

```bash
# shared schemas (no database needed)
npm test -w packages/shared

# web components (no database needed)
npm test -w web

# API integration tests: needs an empty PostgreSQL database
createdb taskline_test   # or: docker compose up -d db && docker compose exec db createdb -U taskline taskline_test
TEST_DATABASE_URL=postgresql://taskline:taskline@localhost:5432/taskline_test npm test -w backend
```

The backend suite (`backend/tests`) migrates the test database, then exercises the real HTTP stack with Supertest. It covers registration and login, token expiry, forged and `alg: none` tokens, refresh rotation and reuse detection, logout, project and task CRUD, every validation rule, search, filters, sorting, pagination, ownership isolation between two users, dashboard numbers, audit logs, RBAC, rate limiting, CORS and security headers.

Current status: **89 backend + 23 shared + 10 web tests passing**. CI runs all of them on every push (`.github/workflows/ci.yml`).

## CI/CD

| Workflow | Trigger | What it does |
| --- | --- | --- |
| [`ci.yml`](.github/workflows/ci.yml) | every push / PR | install, typecheck all 4 packages, run every test suite against PostgreSQL, build API + web, build both Docker images, then (on `main`) trigger the Render deploy hook |
| [`due-reminders.yml`](.github/workflows/due-reminders.yml) | every 30 min | calls `POST /api/jobs/due-reminders` so pushes go out even when a free server is asleep |
| [`mobile-build.yml`](.github/workflows/mobile-build.yml) | manual | builds the Android APK on EAS |

Repository secrets they use (all optional, each workflow skips its step when unset): `RENDER_DEPLOY_HOOK_URL`, `API_URL`, `CRON_SECRET`, `EXPO_TOKEN`.

## Screenshots

| Sign in | Projects | Project and its tasks |
| --- | --- | --- |
| ![Login](docs/screenshots/web-login.png) | ![Projects](docs/screenshots/web-projects.png) | ![Project](docs/screenshots/web-project.png) |

| Validation in the task form | Dark mode |
| --- | --- |
| ![Task form](docs/screenshots/web-task-form.png) | ![Dark dashboard](docs/screenshots/web-dashboard-dark.png) |

| Mobile: sign in | Dashboard | Projects | Project tasks | Edit task |
| --- | --- | --- | --- | --- |
| ![](docs/screenshots/mobile-login.png) | ![](docs/screenshots/mobile-dashboard.png) | ![](docs/screenshots/mobile-projects.png) | ![](docs/screenshots/mobile-project.png) | ![](docs/screenshots/mobile-task-edit.png) |

## Design decisions worth mentioning

- **Express 5 over NestJS:** small surface and explicit middleware. Express 5 forwards rejected promises to the error handler, so there is no try/catch boilerplate in controllers.
- **Prisma:** typed queries, readable migrations, and parameterised SQL by default. Rules Prisma can't express (date range, completed_at consistency) are added as `CHECK` constraints in a hand-written migration.
- **No `userId` on tasks:** keeps the schema in 3NF, and ownership checks always go through the project.
- **Cookie for web, Keystore for mobile:** each platform gets its own safest token storage, through one API.
- **Server-side search, filtering and paging:** the web and mobile lists show identical results and scale beyond one page of data.
- **No UI kit:** the web UI is hand-written CSS Modules with a small token set (paper, ink, terracotta accent; olive, ochre and stone for statuses). It supports light and dark mode.

---

Built by Utsav Majumdar (RA2311056010143).
