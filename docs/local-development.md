# Local Development Guide

This guide runs the integrated Student Progress Dashboard locally: Express API,
SQLite development database, and the React/Vite client.

## Prerequisites

- Node.js >= 20.19.0 (verified with Node 22.15.0)
- npm >= 10 (verified with npm 10.9.2)
- A C/C++ toolchain only if `better-sqlite3` has no prebuilt binary for your platform
- No Excel workbook is required for the demo login

## 1. Install dependencies

From the repository root:

```bash
npm install
```

This installs all workspaces (`shared`, `server`, `client`) and builds
`@spd/shared` via the `postinstall` script.

## 2. Configure the local environment

```bash
cp .env.example .env
```

Generate a local session secret instead of using the placeholder:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set the result as `SESSION_SECRET` in `.env`. Key settings:

| Variable | Local value | Meaning |
| --- | --- | --- |
| `PORT` | `4000` | Express port |
| `DB_CLIENT` | `better-sqlite3` | Development database |
| `SQLITE_PATH` | `data/dev.sqlite` | Gitignored SQLite file under `server/` |
| `CORS_ORIGIN` | `http://localhost:5173` | Vite origin |
| `VITE_API_BASE_URL` | `/api/v1` | Relative API path through the Vite proxy |
| `VITE_ENABLE_MOCKS` | `false` | Integrated mode uses Express, not MSW |
| `DEMO_DEFAULT_PASSWORD` | blank | Blank uses the documented local demo default |
| `ADMIN_EMAIL` | blank | Set to an imported student email to grant admin import access |

Never commit `.env`. It is gitignored.

## 3. Set up the database

```bash
npm run db:migrate
npm run db:seed
npm run db:demo
```

- `db:migrate` applies the append-only Knex migrations to SQLite.
- `db:seed` loads the 13-module catalog and three fictional students on
  `example.com` (no passwords, no real data).
- `db:demo` provisions a local-only password on the fictional demo student.

The demo account after `db:demo`:

- Email: `aanya.fictional@example.com`
- Password: the value of `DEMO_DEFAULT_PASSWORD`, or `demo1234` when it is blank
- Data: fictional fixture records only

`db:demo` refuses to run when `NODE_ENV=production`.

## 4. Start both applications

```bash
npm run dev
```

This runs Express and Vite together:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Login page: http://localhost:5173/login
- Dashboard: http://localhost:5173/dashboard

Run them separately if preferred:

```bash
npm run dev:server
npm run dev:client
```

Vite proxies `/api` to `http://localhost:4000`, so the browser only talks to
port 5173 and session cookies stay same-origin.

## 5. Verify the API

```bash
curl http://localhost:4000/api/v1/healthz
curl http://localhost:5173/api/v1/healthz   # through the Vite proxy
```

Both should return `{"status":"ok",...}`.

The authenticated endpoints require a `spd.sid` cookie plus an
`x-csrf-token` header. The React client fetches the token from
`GET /api/v1/auth/csrf` and keeps it in memory only.

## 6. Excel import (admin only)

Real workbooks contain student PII and must never be committed. For local
testing use a sanitized workbook and a student whose email matches
`ADMIN_EMAIL`.

1. Set `ADMIN_EMAIL` in `.env` to the sanitized workbook's admin email.
2. Re-run `npm run db:migrate` (if needed) and import through the admin
   endpoint with a session cookie and CSRF token:

```bash
# after logging in, POST multipart/form-data as field "file"
curl -b cookies.txt -H "x-csrf-token: <token>" \
  -F "file=@/path/to/sanitized.xlsx" \
  http://localhost:4000/api/v1/admin/import/excel
```

Import archives go to `server/data/private/` (gitignored). Generated plaintext
credentials are written once to `server/data/private/credentials.csv`
(gitignored) unless `DEMO_DEFAULT_PASSWORD` is set.

## 7. Useful commands

```bash
npm run typecheck     # shared + server + client
npm test              # Vitest across all workspaces
npm run build         # shared -> server -> client production build
npm run db:reset      # roll back and re-apply schema (run db:seed after)
```

## 8. Troubleshooting

- **Port already in use**: stop the other process or change `PORT`; update the
  Vite proxy target in `client/vite.config.ts` if you change the backend port.
- **`better-sqlite3` install failure**: install build tools, or use a Node
  version with a prebuilt binary.
- **401 on dashboard**: sign in again. Sessions are server-side and expire after
  `SESSION_TTL_HOURS`.
- **403 `invalid_csrf_token`**: the client must fetch `/auth/csrf` before a
  state-changing request. Clearing cookies and reloading fixes stale sessions.
- **Login shows mock data**: set `VITE_ENABLE_MOCKS=false` and restart Vite.
  MSW is for isolated frontend tests only.
- **Demo login fails**: confirm `npm run db:migrate`, `db:seed`, and `db:demo`
  ran against the same `SQLITE_PATH`.
- **Session secret error in production**: `SESSION_SECRET` is required when
  `NODE_ENV=production`.

## Security notes

- `.env`, SQLite files, workbooks, and credentials files are gitignored.
- Do not copy real student records into fixtures or MSW handlers.
- Do not store passwords, session secrets, or CSRF tokens in browser storage.
- The AI Skill Coach panel is a labeled placeholder in this phase; no AI keys
  exist in the client.
