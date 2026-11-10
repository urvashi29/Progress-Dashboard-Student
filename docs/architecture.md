# Student Progress Dashboard — Architecture

I inspected module-wise-dataset.xlsx read-only (no packages installed, no files changed). Here's what it actually contains and how the plan changes.

## 1. Excel audit — what's really in the file

| Finding | Value | Design impact |
| --- | --- | --- |
| Rows | 173 (1 fully empty) | Import 172; report the blank row |
| Columns | 40 | 14 student/enrollment fields + 13 × (module name, progress %) |
| Course types | 170 data-science, 2 web3 | Import data-science only; report skipped rows |
| Progress | Integers 0–100, valid | Safe to parse as numbers |
| Dates | Excel serials (e.g. 45657) for cohort start, enrollment, access expiry, last update | Backend converts serial → ISO date |
| Module order | Shifts per row (M5–M13 rearranged; one row has 12 modules, one has 9) | Map modules by name, not by M-number — this is the most important ingestion rule |
| Duplicates | 2 duplicate emails | Natural key = (email, cohort); report duplicates |
| overall_progress_pct | Not equal to average of modules (mean difference 13.6; one student 100 overall vs 69 average) | Treat platform overall as authoritative; never recompute it as a mean |
| Pace | Median actual/expected = 0.32; 97 of 164 below 0.5 | Health must be pace-aware, not absolute-only |
| Module numbering | Not delivery order (most students have M1 + M9–M13 progress, M2–M8 at 0) | Use a curated catalog order, not M-index |

PII note: the file contains real names and emails. It must never be committed — goes in server/data/private/ (gitignored), tests use a sanitized fixture with fake identities.

## 2. Key architecture decisions (revised)

- Node/Express backend — client/ (React) + server/ (Express) in one repo with npm workspaces. Excel parsing (xlsx), auth, rules, and future LLM keys all live in server/.
- Module identity = normalized name. Ingestion trims/lowercases and maps each Mx name cell to a catalog module. Unknown names go into the import report instead of failing the file.
- Two distinct progress numbers:
  - `overall_progress_pct` — platform value, displayed as "Overall progress."
  - module progress — 13 values for breakdown.
  - We do not claim our average equals the platform overall; we show both and state the difference.
- Health is pace-aware: expected progress from cohort_start_date → course_access_expiry_date; staleness from progress_last_updated_at_ist. This is why dates matter.
- Default accounts: login = user_email_id; import generates a temporary password per student, stores only a bcrypt hash, and writes plaintext once to server/data/private/credentials.csv (gitignored). DEMO_DEFAULT_PASSWORD env can force one shared password for local demos.
- Skills are inferred, not measured. Excel has no skill rows, so the catalog defines 3–5 skills + action templates per module. UI labels them "estimated," confidence low.

## 3. Ingestion pipeline (concrete)

```
POST /admin/import/excel (admin only)
  1. read sheet → validate 14 fixed columns + M1..M13 pairs
  2. skip empty-email rows, non-data-science rows (report both)
  3. normalize module names → catalog lookup (report unknown)
  4. parse progress (0–100), parse Excel serial dates
  5. upsert student by lower(email); upsert enrollment by (student, cohort)
  6. first insert → temp password + bcrypt hash; append credentials.csv
  7. write import job: rows_total / imported / skipped / warnings[]
```

Idempotent: re-importing the same file updates progress, doesn't duplicate students. File hash stored.

## 4. Catalog (13 modules, 4 tracks)

Tracks are display/rollup only; health still uses all modules.

| Track | Modules |
| --- | --- |
| Foundations | Intro to Computer Programming · Numerical Programming in Python · Relational Databases |
| Data & Analytics | Data Visualization Tools · Applied Business Analytics |
| AI & ML | Advanced Machine Learning · Intro to Deep Learning · DL for Computer Vision · DL for NLP · Distributed ML · ML & GenAI with Microsoft Azure |
| Production & Industry | Productionization of ML Systems · Industry Immersion |

Catalog also stores per module: skills (importance + weight), prerequisite modules, activity templates (title, minutes, type), and minutes-per-1%-progress (used for fast-completion estimates). This is the only place we author content; everything else is data-driven.

## 5. Data model (SQLite dev / Postgres prod)

```
students(id, name, email unique, password_hash, must_change_password, created_at)
enrollments(id, student_id, cohort, plan_type, sub_plan_type, course_type,
            cohort_start_date, enrolled_at, access_expiry_date,
            overall_progress_pct, progress_updated_at, import_id)
modules(id, slug, name, track, catalog_order)
module_progress(enrollment_id, module_id, progress_pct, in_plan, updated_at)  # unique pair
skills(id, module_id, name, importance, weight, prereq_skill_ids, activity_templates JSON)
events(id, student_id, enrollment_id, type, module_id, metadata_json, created_at)
imports(id, filename, file_hash, rows_total, imported, skipped, report_json, created_at)
```

`in_plan = false` when a module is absent from the student's row — distinct from `progress = 0` (real zero progress).

## 6. API endpoints

| Method | Path |
| --- | --- |
| POST | /api/v1/auth/login (email + password → HttpOnly cookie) |
| POST | /api/v1/auth/logout · GET /api/v1/auth/me |
| GET | /api/v1/me/dashboard (overall, health, 4 tracks, 13 modules, coach summary) |
| GET | /api/v1/me/modules · /api/v1/me/modules/:slug |
| GET | /api/v1/me/modules/:slug/plan |
| POST | /api/v1/me/modules/:slug/plan (generate + plan_generated event) |
| GET | /api/v1/me/coach · POST /api/v1/me/coach/refresh |
| POST | /api/v1/me/events (batched tracking) |
| POST | /api/v1/admin/import/excel · GET /api/v1/admin/imports |
| GET | /api/v1/catalog/modules · /api/v1/healthz |

No studentId in any student route. Identity comes from the session, so a student cannot read another's data (prevents IDOR). Admin routes require an admin role.

## 7. Health logic (with this dataset)

```
expectedPct = clamp(daysSince(cohortStart) / daysBetween(cohortStart, accessExpiry) * 100, 0, 100)
paceRatio   = expectedPct > 5 ? progressPct / expectedPct : null
staleDays   = today - progress_updated_at
```

Status:

- expectedPct < 10 → Getting Started (don't punish brand-new cohorts)
- paceRatio ≥ 0.9 and staleDays ≤ 14 → On Track
- 0.7–0.9 → Slightly Behind
- 0.4–0.7 → Behind
- < 0.4 → Critical
- if staleDays > 30 → downgrade one level

Module cards use absolute bands (Strong ≥ 80, On Track 50–79, Needs Attention 20–49, Not Started 0, Not in plan). The health card always lists reasons, e.g. "Behind — 34% overall vs 71% expected for this cohort; last update 46 days ago."

Given the real pace median of 0.32, many students will honestly show Behind/Critical. That is a finding, not a bug — and it's worth surfacing to the program team.

## 8. Coach & "complete this module fast"

Recommendation types: START_MODULE (0%, prereqs met), RESCUE_MODULE (started, low), NEAR_FINISH (80–99), QUICK_WIN (high impact/minute), UNBLOCK (prerequisite low), MOMENTUM (next after a completed module).

Fast plan for a module:

```json
{
  "module": "relational-databases",
  "currentProgress": 35,
  "remaining": 65,
  "steps": [
    { "order": 1, "skill": "SQL joins", "action": "Practice 12 join queries",
      "minutes": 25, "expectedGainPct": 5, "why": "Critical skill · prerequisite for Module 11" }
  ],
  "totalMinutes": 210,
  "projectedCompletionDate": "2026-12-08",
  "confidence": "low",
  "caveat": "Skill mastery is estimated from module progress."
}
```

Ranking: importance × gap × (1 + dependents) / minutes, prerequisites first. Because the Excel has no activity data, actions come from the catalog templates, and this is stated explicitly in the UI.

Tracking events: login, dashboard_viewed, module_opened, plan_generated, recommendation_clicked, module_goal_set. Used for staleness and engagement later.

## 9. Frontend (unchanged shape)

/login → /dashboard (sidebar: Progress Dashboard only) → /modules/:slug.

Dashboard: health card with reasons, 4 track rollups, 13 module cards, Recharts (module comparison, track comparison, importance vs estimated mastery), Skill Coach panel, and the "How to complete this module fast" button. No student list, no PII beyond display name.

## 10. Phases & agents (Node)

| Phase | Worktree | Scope |
| --- | --- | --- |
| 0 | foundation | Workspaces, Vite + Express scaffold, DB schema, catalog skeleton, Zod contracts, MSW fixtures, .env.example, .gitignore (protects Excel) |
| 1 | ingestion-auth | Excel parser, import job/report, accounts + cookies, /auth/* |
| 2 | api-health | Dashboard/module endpoints, pace + health service, tests |
| 3 | ui-shell | Login, AppShell, sidebar, dashboard sections + charts on mocks |
| 4 | coach | Catalog skills/activity templates, rules engine, plan endpoint, coach panel |
| 5 | qa | Ingestion tests (sanitized fixture), auth isolation, pace/health boundaries, E2E, a11y, CI |
| 6 | integration | Real import → dashboard → plan; merge order 0 → 1 → 2 → 3 → 4 → 5 |
| 7 | hardening | PII/secrets review, error handling, deploy |

## 11. Acceptance criteria for ingestion (new)

- Import reports exactly: 173 total, 1 blank skipped, 2 non-DS skipped, 2 duplicate-email warnings.
- Module progress is mapped by name; the rows with reordered/partial modules still import correctly.
- overall_progress_pct stored as-is; the UI never labels the module average as overall.
- Dates stored as ISO; pace computed at request time (not at import).
- Re-import is idempotent; no duplicate accounts.
- Credentials CSV exists only locally and is gitignored.
- Login returns only that student's enrollment; cross-student access returns 403/404.
- Dashboard numbers equal Excel values for a spot-checked sample of rows.

Defaults I'll use unless you say otherwise:

- One account per email; duplicate emails resolve to the latest cohort and are flagged in the import report.
- Non-data-science rows are skipped, not deleted.
- Temporary random passwords + a local credentials.csv; DEMO_DEFAULT_PASSWORD for easy demos.
- Pace thresholds as above; "Getting Started" for very new cohorts.
- Catalog skill/activity content authored by us and shown for your review before Phase 4.
