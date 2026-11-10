# Agent contracts — Student Progress Dashboard

Source of truth for product requirements: [`docs/architecture.md`](./architecture.md).
This document defines **ownership, shared contracts, and non-negotiable invariants** for parallel agents working in Phase 1+.

Phase 0 is complete on branch `feature/foundation`. Do not merge into `main` automatically; integration happens in Phase 6 in the order `foundation → ingestion-auth → api-health → ui-shell → coach → qa`.

## 1. Repository layout

```
.
├── package.json                  # workspaces: shared, server, client; root scripts
├── .env.example                  # documented env vars only — no real secrets
├── .gitignore                    # blocks spreadsheets, private data, credentials, DBs
├── docs/
│   ├── architecture.md           # finalized specification (do not rewrite)
│   └── agent-contracts.md        # this file
├── shared/                       # @spd/shared
│   └── src/
│       ├── common.ts             # ISO dates, percent, slug, enums
│       ├── students.ts           # Student, StudentProfile
│       ├── enrollments.ts        # Enrollment, EnrollmentSummary
│       ├── modules.ts            # Track, Skill, CatalogModule, ModuleProgress + bands
│       ├── health.ts             # HealthAssessment contract (no calculation)
│       ├── recommendations.ts    # Recommendation, CoachSummary, FastPlan
│       ├── dashboard.ts          # DashboardResponse, TrackRollup, ProgressComparison
│       ├── catalog.ts            # 13 modules, 4 tracks, normalize/lookup helpers
│       ├── fixtures/             # fictional students/enrollments/progress/dashboard
│       ├── index.ts
│       └── __tests__/
├── server/                       # @spd/server (Express, Knex)
│   ├── migrations/               # append-only, dialect-neutral Knex migrations
│   ├── src/
│   │   ├── app.ts                # Phase 0 routes: healthz + catalog
│   │   ├── index.ts              # HTTP bootstrap
│   │   ├── config/env.ts         # Zod-validated environment
│   │   └── db/                   # client, config, migrate, seed, reset
│   └── tests/
└── client/                       # @spd/client (React + Vite)
    ├── public/mockServiceWorker.js
    └── src/
        ├── App.tsx               # Phase 0 status shell only
        ├── mocks/                # MSW handlers backed by shared fixtures
        └── test/
```

Phase 0 intentionally has **no** Excel import, login, dashboard, or coach implementation.

## 2. Non-negotiable invariants

Any phase that breaks one of these must be rejected in review.

1. **Module identity is the normalized name, never spreadsheet position.**
   Use `normalizeModuleName()` / `findModuleByName()` from `@spd/shared`. `M1..M13` headers only locate cells. Reordered or partial module columns must import correctly; unknown names go to the import report, never crash the file.
2. **`overall_progress_pct` is authoritative.**
   Store the platform value as-is. Never recompute overall as a module mean. APIs expose `overallProgressPct` separately from `progressComparison.moduleAveragePct`, whose UI label must say it is reference only.
3. **Missing module ≠ 0% progress.**
   `module_progress.in_plan = false` means the module was absent from the student's row. It must not be coerced to an in-plan 0. Bands distinguish `NOT_IN_PLAN` from `NOT_STARTED`; the dashboard schema validates this.
4. **Skills are estimated, never measured.**
   `Skill.estimated` is the literal `true`, `confidence` defaults to `low`, and `FastPlan.estimated` is `true`. UI must say "estimated". No copy may claim measured proficiency.
5. **No real student data or secrets in git.**
   The real `.xlsx` is read-only input and must live outside commits. Private artifacts belong in `server/data/private/` (gitignored). Tests/fixtures use fictional identities on `example.com` only. Never commit API keys, bcrypt hashes, plaintext credentials, or `.env`.
6. **Dates are ISO-8601 text.**
   Excel serial conversion belongs to ingestion (Phase 1). Health/pace is computed at request time (Phase 2), never precomputed at import.
7. **Student identity comes from the session.**
   No student-facing route accepts `studentId`. Cross-student access returns 403/404. Admin routes require an admin role.
8. **One account per normalized email.**
   Natural key for enrollments is `(student, cohort)`. Re-import is idempotent and must not duplicate students or accounts.

## 3. Shared contract ownership

`@spd/shared` is owned by **foundation**. Other agents consume it; they do not fork or shadow it.

| Contract | File | Primary consumers |
| --- | --- | --- |
| `StudentSchema`, `StudentProfileSchema` | `shared/src/students.ts` | auth, dashboard, UI |
| `EnrollmentSchema`, `EnrollmentSummarySchema` | `shared/src/enrollments.ts` | ingestion, health, dashboard |
| `CatalogModuleSchema`, `SkillSchema`, `ModuleProgressSchema`, `moduleProgressBand` | `shared/src/modules.ts` | ingestion, dashboard, plan, UI |
| `HealthAssessmentSchema` | `shared/src/health.ts` | health service, dashboard, UI |
| `RecommendationSchema`, `CoachSummarySchema`, `FastPlanSchema` | `shared/src/recommendations.ts` | coach, dashboard, UI |
| `DashboardResponseSchema`, `TrackRollupSchema` | `shared/src/dashboard.ts` | API, MSW, UI |
| `MODULES`, `TRACKS`, lookup helpers | `shared/src/catalog.ts` | ingestion lookup, DB seed, API, UI |

**Changing a shared contract**

- Prefer additive, optional changes. Do not repurpose existing field names.
- Update the Zod schema, the TypeScript fixture(s), the server catalog endpoint, MSW handlers, and any affected tests in the same change.
- Run `npm run typecheck && npm test` at the root before handing off.
- Record a one-line entry in the changelog below and tell the integration owner.

Do not put phase-specific business logic in `shared/`. Health computation goes in `server/src/` (Phase 2), coach ranking in `server/src/` (Phase 4).

## 4. Ownership by phase

| Phase | Owns | May read | Must not do |
| --- | --- | --- | --- |
| 0 foundation | root config, `shared/**`, server scaffolding/migrations `0001`, catalog constants, fixtures, MSW, this doc | architecture | implement import/auth/dashboard/coach |
| 1 ingestion-auth | `server/src/ingestion/**`, `server/src/auth/**`, auth routes, migration `0002+`, import report | `shared/**`, catalog | change overall-progress semantics, edit `0001`, commit private files |
| 2 api-health | dashboard/module endpoints, pace/health service, health tests | contracts, DB schema | add `studentId` to student routes, modify catalog content |
| 3 ui-shell | `client/src/**` pages, shell, charts | contracts, MSW fixtures | add a student list, show PII beyond display name |
| 4 coach | catalog skills/activity templates (proposal reviewed first), rules engine, plan endpoint, coach panel | contracts, Phase 2 services | claim measured skill mastery |
| 5 qa | sanitized import fixture, auth isolation, health boundaries, E2E, a11y, CI | everything | relax invariants to make tests pass |
| 6 integration | merge order, integration verification | all | merge before phase gates pass |
| 7 hardening | PII/secrets review, error handling, Postgres deploy | all | change product behavior |

### Shared-file coordination

- `shared/src/catalog.ts`: content (skills, minutes, prerequisites) may be extended in Phase 4, but the schema and module identity stay owned by foundation.
- `server/migrations/`: **append-only** after a migration is merged. Never edit `0001_initial_schema.js`; add `0002_…` instead.
- `server/src/db/seed.ts`: keep idempotent upserts. Never seed real data.
- `client/src/mocks/`: MSW handlers must derive from shared fixtures, not hand-copied JSON.
- `docs/architecture.md`: read-only reference; do not rewrite it.

## 5. Database contract

- Dev: SQLite via `better-sqlite3` at `server/data/dev.sqlite` (gitignored).
- Prod target: PostgreSQL. Set `DB_CLIENT=pg` and `DATABASE_URL`; the same Knex migrations run unchanged.
- Schema: `students`, `enrollments`, `modules`, `module_progress`, `skills`, `events`, `imports`.
- Date columns are ISO-8601 `text` (`YYYY-MM-DD` or full timestamp). Convert Excel serials during ingestion.
- `password_hash` is nullable until Phase 1 provisions accounts; store bcrypt hashes only.
- `module_progress` is unique on `(enrollment_id, module_id)`; `enrollments` is unique on `(student_id, cohort)`.
- Migrations are CommonJS `.js` so they run identically from `tsx` (dev) and compiled `dist` (prod).

Commands:

```bash
npm run db:migrate    # apply pending migrations
npm run db:seed       # idempotent catalog + fictional mock data
npm run db:reset      # roll back all, re-apply schema (run db:seed after)
```

## 6. API and ingestion handoff notes

Phase 0 routes that exist: `GET /api/v1/healthz`, `GET /api/v1/catalog/modules`.

Planned route ownership from the architecture:

- Phase 1 `POST /api/v1/auth/login|logout`, `GET /api/v1/auth/me`, `POST /api/v1/admin/import/excel`, `GET /api/v1/admin/imports`.
- Phase 2 `GET /api/v1/me/dashboard`, `/me/modules`, `/me/modules/:slug`, `POST /me/events`.
- Phase 4 `GET|POST /api/v1/me/modules/:slug/plan`, `GET /api/v1/me/coach`, `POST /api/v1/me/coach/refresh`.

Ingestion (Phase 1) must:

1. Read the 14 fixed fields plus `M1..M13` pairs, but resolve modules via `findModuleByName()`.
2. Skip blank-email and non-`data-science` rows and report counts/warnings; never silently drop.
3. Parse progress as bounded integers; convert Excel serial dates to ISO.
4. Upsert student by `lower(email)` and enrollment by `(student, cohort)`.
5. Preserve platform overall progress exactly; write `in_plan=false` for absent module cells.
6. Provision a temporary password only on first insert, store a bcrypt hash, and write plaintext once to `server/data/private/credentials.csv` (gitignored).
7. Store a file hash and import report; re-import updates progress without duplicates.

Import reports must state: 173 total, 1 blank skipped, 2 non-data-science skipped, 2 duplicate-email warnings.

## 7. Development commands

```bash
npm install             # installs workspaces and builds @spd/shared
cp .env.example .env    # local only
npm run db:migrate
npm run db:seed
npm run dev             # Express :4000 + Vite :5173 (MSW on when VITE_ENABLE_MOCKS=true)
npm run build           # shared → server → client
npm test                # shared + server + client (Vitest)
npm run typecheck       # all workspaces
```

Client note: Vite resolves `@spd/shared` to `shared/src/index.ts` so UI builds do not depend on the CJS output. Server and Node-side tests consume `shared/dist`; root scripts build shared first.

## 8. Phase 0 definition of done

- [x] npm workspaces for `shared`, `server`, `client`
- [x] React + Vite client shell (no login/dashboard)
- [x] Express server with health and catalog routes (no auth/import/dashboard)
- [x] Zod contracts for students, enrollments, modules, dashboard, health, recommendations
- [x] SQLite + Knex migrations, seed, Postgres-ready config
- [x] 13-module catalog across the 4 approved tracks, with estimated skills and activity templates
- [x] Fictional fixtures + MSW handlers (no real identities)
- [x] `.env.example`, `.gitignore` protections
- [x] Root scripts for dev/build/test/typecheck/db
- [x] Tests and production build passing

## 9. Changelog

- Phase 0 (foundation): initial workspaces, contracts, catalog, SQLite schema, fixtures, MSW, docs.
