# API reference

Base URL: `http://localhost:4000/api` locally, or `https://<your-backend>/api` once deployed.
The web app and the Android app call exactly these endpoints. There is no separate mobile API.

- Request and response bodies are JSON.
- Calendar dates (`startDate`, `endDate`, `dueDate`) are `YYYY-MM-DD` strings. Timestamps (`createdAt`, …) are ISO 8601 in UTC.
- Protected endpoints need `Authorization: Bearer <accessToken>`.
- Every response carries an `X-Request-Id` header, which is also written to the server log.

## Authentication model

| Token         | Lifetime                         | Where it lives                                                                                                |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Access token  | 15 min (`ACCESS_TOKEN_TTL_MINUTES`) | JWT (HS256). Kept in memory by both apps and sent as a Bearer header.                                        |
| Refresh token | 30 days (`REFRESH_TOKEN_TTL_DAYS`), extended on use | Opaque `<sessionId>.<secret>`. **Web:** httpOnly `taskline_rt` cookie (path `/api/auth`). **Mobile:** returned in the body and stored in the Android Keystore via `expo-secure-store`. |

A native client says so with the header `x-client-platform: mobile`. Without it, the API treats the caller as a browser and uses the cookie.

Each login creates a **session** row. The access token carries the session id, and `authenticate` checks that the session is still active, so **logout takes effect immediately**. Refresh tokens are **rotated** on every use. Presenting an already-rotated token (outside a 60-second grace window for parallel requests) is treated as theft, and the whole session is revoked.

## Errors

Every error has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the highlighted fields",
    "details": [{ "field": "endDate", "message": "End date cannot be before the start date" }],
    "requestId": "6f0c2c7e-…"
  }
}
```

| Status | `code`                                | When                                                                 |
| ------ | ------------------------------------- | -------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`                    | Body or query failed validation, or the body is malformed JSON       |
| 401    | `UNAUTHORIZED`                        | Missing, malformed or forged access token                            |
| 401    | `TOKEN_EXPIRED`                       | Access token expired: call `/auth/refresh` and retry                 |
| 401    | `SESSION_EXPIRED`                     | Session revoked or expired, or the refresh token is invalid: sign in again |
| 401    | `INVALID_CREDENTIALS`                 | Wrong email or password (same message for both)                      |
| 403    | `FORBIDDEN`                           | Authenticated but missing the required role                          |
| 404    | `NOT_FOUND`                           | Record doesn't exist **or belongs to another user**                  |
| 409    | `CONFLICT`                            | Email already registered                                             |
| 413    | `VALIDATION_ERROR`                    | Body larger than 100 kB                                              |
| 429    | `RATE_LIMITED`                        | Too many requests (see `Retry-After`)                                |
| 500    | `INTERNAL_ERROR`                      | Unexpected server error (details only go to the log)                 |

## Rate limits

| Scope                         | Limit                                                  |
| ----------------------------- | ------------------------------------------------------ |
| `POST /auth/login`            | 10 **failed** attempts per IP per 15 min (successful logins don't count) |
| `POST /auth/register`, `/auth/refresh` | 30 requests per IP per 15 min                 |
| Everything under `/api`       | 300 requests per IP per minute                         |

All values are configurable through environment variables.

---

## Auth

### `POST /auth/register`

```json
{ "fullName": "Asha Rao", "email": "asha@example.com", "password": "Secret123" }
```

Rules: name 2–100 chars, valid email (stored lower-case, must be unique), password 8–72 chars with at least one letter and one number.

`201 Created`

```json
{
  "user": { "id": "…", "fullName": "Asha Rao", "email": "asha@example.com", "role": "USER", "createdAt": "…" },
  "accessToken": "eyJhbGciOi…",
  "accessTokenExpiresAt": "2026-10-07T17:21:00.000Z",
  "refreshToken": "…",
  "refreshTokenExpiresAt": "…"
}
```

`refreshToken*` only appear for `x-client-platform: mobile`. Browsers get a `Set-Cookie: taskline_rt=…; HttpOnly; Path=/api/auth` instead.
Errors: `400`, `409`.

### `POST /auth/login`

```json
{ "email": "asha@example.com", "password": "Secret123" }
```

`200 OK`, same body as register. Errors: `400`, `401 INVALID_CREDENTIALS`, `429`.

### `POST /auth/refresh`

Requires the `x-client-platform` header (`web` or `mobile`). A cross-site form can't send custom headers, so this blocks CSRF on the cookie.

- Web: no body needed, the cookie is sent automatically.
- Mobile: `{ "refreshToken": "…" }`

`200 OK`, same body as login with a new access token and a rotated refresh token. Errors: `401 SESSION_EXPIRED`.

### `POST /auth/logout` (protected)

Revokes the current device's session and clears the cookie. Other devices stay signed in. `204 No Content`.

### `GET /auth/me` (protected)

`200 OK` → `{ "user": { … } }`

---

## Projects (protected)

A project's response always includes task counts and progress:

```json
{
  "id": "4fff76d2-…",
  "name": "Campus fest website",
  "description": "Event site for the annual tech fest",
  "status": "IN_PROGRESS",
  "startDate": "2026-09-17",
  "endDate": "2026-11-01",
  "createdAt": "2026-10-07T17:04:57.658Z",
  "updatedAt": "2026-10-07T17:04:57.658Z",
  "taskCounts": { "total": 6, "completed": 2 },
  "progress": 33
}
```

### `GET /projects`

| Query    | Type                                                 | Default     |
| -------- | ---------------------------------------------------- | ----------- |
| `search` | text, matched case-insensitively against the name   | –           |
| `status` | `NOT_STARTED` \| `IN_PROGRESS` \| `COMPLETED`        | –           |
| `sortBy` | `createdAt` \| `name` \| `startDate` \| `endDate` \| `status` | `createdAt` |
| `order`  | `asc` \| `desc`                                      | `desc`      |
| `page`   | integer ≥ 1                                          | `1`         |
| `limit`  | 1–100                                                | `20`        |

`200 OK`

```json
{ "data": [ { …project } ], "meta": { "page": 1, "limit": 20, "total": 4, "totalPages": 1 } }
```

### `GET /projects/:id`

`200 OK` → `{ "project": { … } }`. Errors: `404`.

### `POST /projects`

```json
{
  "name": "Lab report",
  "description": "Optional",
  "status": "NOT_STARTED",
  "startDate": "2026-01-10",
  "endDate": "2026-01-20"
}
```

Only `name` is required (1–120 chars, not blank). `status` defaults to `NOT_STARTED`. Dates must be real calendar dates, and `endDate` can't be before `startDate`. Empty strings for `description`/dates are stored as `null`. Unknown fields are ignored, so `userId` can't be injected.
`201 Created` → `{ "project": { … } }`. Errors: `400`.

### `PUT /projects/:id`

Same fields as create, all optional (at least one required). Fields you leave out are not changed. Send `null` to clear an optional field. The date range is validated against the stored values too.
`200 OK` → `{ "project": { … } }`. Errors: `400`, `404`.

### `DELETE /projects/:id`

Deletes the project **and its tasks**. `204 No Content`. Errors: `404`.

---

## Tasks (protected)

```json
{
  "id": "e8bcff53-…",
  "projectId": "4fff76d2-…",
  "project": { "id": "4fff76d2-…", "name": "Campus fest website", "status": "IN_PROGRESS" },
  "name": "Build event schedule page",
  "description": "Day-wise tabs, filter by venue.",
  "priority": "HIGH",
  "status": "IN_PROGRESS",
  "dueDate": "2026-10-08",
  "completedAt": null,
  "createdAt": "…",
  "updatedAt": "…"
}
```

### `GET /tasks`

| Query       | Type                                                         | Default     |
| ----------- | ------------------------------------------------------------ | ----------- |
| `projectId` | uuid. Only this project's tasks (404 if it isn't yours)      | all projects |
| `search`    | text, case-insensitive match on the task name                | –           |
| `status`    | `PENDING` \| `IN_PROGRESS` \| `COMPLETED`                    | –           |
| `priority`  | `LOW` \| `MEDIUM` \| `HIGH`                                  | –           |
| `dueOn`     | `YYYY-MM-DD`. Only tasks due that day                        | –           |
| `sortBy`    | `createdAt` \| `name` \| `dueDate` \| `priority` \| `status` | `createdAt` |
| `order`     | `asc` \| `desc`                                              | `desc`      |
| `page`, `limit` | as for projects                                          |             |

Filters can be combined, e.g. `/tasks?projectId=…&status=PENDING&priority=HIGH&search=login`.
`200 OK` → `{ "data": [ …tasks ], "meta": { … } }`

### `GET /tasks/:id`

`200 OK` → `{ "task": { … } }`. Errors: `404`.

### `POST /tasks`

```json
{
  "projectId": "4fff76d2-…",
  "name": "Write abstract",
  "description": "Optional",
  "priority": "MEDIUM",
  "status": "PENDING",
  "dueDate": "2026-12-01"
}
```

`projectId` and `name` (1–160 chars) are required. `priority` defaults to `MEDIUM` and `status` to `PENDING`. The project must belong to you, otherwise you get `404`.
`201 Created` → `{ "task": { … } }`

### `PUT /tasks/:id`

Any subset of `projectId`, `name`, `description`, `priority`, `status`, `dueDate`. Marking a task done is just:

```json
{ "status": "COMPLETED" }
```

which also stamps `completedAt`. Moving it back to an open status clears `completedAt`. Changing `projectId` moves the task, but only into another of your projects.
`200 OK` → `{ "task": { … } }`. Errors: `400`, `404`.

### `DELETE /tasks/:id`

`204 No Content`. Errors: `404`.

---

## Dashboard (protected)

### `GET /dashboard?today=YYYY-MM-DD`

`today` is optional. The apps send the device's local date so "overdue" matches what the user sees. Without it, the server's UTC date is used.

```json
{
  "totalProjects": 4,
  "totalTasks": 15,
  "completedTasks": 6,
  "pendingTasks": 7,
  "inProgressTasks": 2,
  "overdueTasks": 1,
  "projectsInProgress": 2,
  "projectsByStatus": { "NOT_STARTED": 1, "IN_PROGRESS": 2, "COMPLETED": 1 },
  "tasksByStatus": { "PENDING": 7, "IN_PROGRESS": 2, "COMPLETED": 6 },
  "tasksByPriority": { "LOW": 4, "MEDIUM": 7, "HIGH": 4 },
  "completionRate": 40,
  "upcomingTasks": [ …up to 6 open tasks with the nearest due dates ]
}
```

`pendingTasks` counts tasks whose status is **Pending**. In-progress tasks are reported separately, so `completed + pending + inProgress = total`.

---

## Extras

| Endpoint                | Auth   | Description                                                                 |
| ----------------------- | ------ | --------------------------------------------------------------------------- |
| `GET /audit-logs`       | user   | The caller's own activity trail (sign-ins, creates, edits, deletes), paginated |
| `GET /admin/users`      | ADMIN  | Paginated list of accounts with project counts. No access to other users' projects or tasks |
| `GET /health`           | public | `{ "status": "ok" }` after a DB round-trip; used by Docker/Render health checks |

## Quick test with curl

```bash
API=http://localhost:4000/api

# sign in as the seeded demo user (mobile mode returns the refresh token in the body)
TOKEN=$(curl -s -X POST $API/auth/login \
  -H 'Content-Type: application/json' -H 'x-client-platform: mobile' \
  -d '{"email":"demo@taskline.dev","password":"Demo@1234"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken')

curl -s $API/dashboard -H "Authorization: Bearer $TOKEN"
curl -s "$API/tasks?status=PENDING&priority=HIGH" -H "Authorization: Bearer $TOKEN"
```
