# Technical Design and Test Plan (TDD): Church Management System

How the system is built and how it is tested. Product scope lives in `docs/PRD.md`; the domain model in `docs/DDD.md`; phase status in `docs/ROADMAP.md`.

## 1. Architecture

```
Browser ──▶ Next.js web (port 3002) ──/api rewrite──▶ NestJS API (port 4000) ──Prisma──▶ PostgreSQL (port 5433)
                 │                                         │
                 └──────── @cms/shared (Zod schemas, pure domain functions) ───────┘
```

| Package | Role |
|---|---|
| `packages/shared` | Zod schemas, permission map, pure domain functions; imported by API and web |
| `packages/database` | Prisma schema, migrations, generated client, seeders |
| `api` | NestJS REST API, guards, services, OpenAPI and Scalar docs |
| `web` | Next.js 16 App Router: admin app and public site |

## 2. Cross-cutting Design

- Auth: JWT in an httpOnly, same-site cookie; the web calls `/api` through a Next.js rewrite so the cookie stays first-party. `JwtAuthGuard` then `PermissionsGuard` (`@RequirePermissions`) run on every route unless `@Public()`.
- Branch scope: reads use `branchFilter(actor, requested)`; writes call `assertBranchAccess`. Branch users can never widen scope.
- Validation: every body, query, and param passes a shared Zod schema through `ZodValidationPipe`; the same schema feeds OpenAPI through `ZodBody` and `ZodQuery`.
- Audit: `AuditService.record` on every write, redacting keys matching `password|token|secret|hash|pickup`.
- Errors: Nest HTTP exceptions; 400 validation, 401 no session, 403 no permission or wrong branch, 404 missing, 409 conflict, 423 locked.
- Rate limiting: `ThrottlerGuard` globally.
- Time: stored in UTC (`timestamptz`); church local time is UTC+8 (`CHURCH_UTC_OFFSET_MINUTES`).
- Web data: TanStack Query hooks per feature (`features/*/api.ts`), session in zustand, UI from shadcn on Base UI, Tailwind 4 e-ink tokens, motion with reduced-motion support.

## 3. Phase 7 Design: Reports

### 3.1 Shared (`packages/shared/src/reports.ts`)

| Export | Purpose |
|---|---|
| `REPORT_KINDS` | `attendance`, `membership`, `ministries`, `events`, `rooms` |
| `reportQuerySchema` | `{ from?, to?, branchId? }`, dates as `YYYY-MM-DD`; refines `from <= to` and range at most 366 days |
| `reportRange(query, now)` | Fills defaults (last 12 weeks to today) and returns local-midnight UTC instants plus day count |
| `OPEN_HOURS_PER_DAY` | 14 |
| `buildAttendanceReport` and siblings | Pure builders from raw rows to `{ columns, rows, summary }` |
| `toCsv(columns, rows)` | RFC 4180 quoting plus formula-injection guard |
| `Report` type | `{ kind, from, to, branchId, columns, rows, summary }` |

### 3.2 API (`api/src/reports/`)

| Route | Permission | Response |
|---|---|---|
| `GET /reports/{kind}` | `reports.read` | `Report` JSON |
| `GET /reports/{kind}/csv` | `reports.read` | `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="<kind>-<from>-to-<to>.csv"`, audited as `reports.export` |
| `GET /public/landing` | none (public, 60 a minute, cached 5 minutes) | Church settings, branches with the next 7 days of services, active ministries, rated rooms (`publicLandingSchema`) |

`ReportsService` runs one or two grouped queries per report (`groupBy` on check-ins and registrations, date-filtered `findMany` on services, events, bookings, roster rows), then hands raw rows to the shared builders. No query per row.

### 3.3 Computations

| Report | Rule |
|---|---|
| Attendance | Services with `startsAt` in range and not archived; per service `reportedAttendance(headcount, checkIns)`; average over services |
| Membership | Month buckets in church local time; new people by `createdAt`; new members by `membershipDate`; baptisms by `baptismDate`; archived people excluded; status totals for people not archived |
| Ministries | Active at end of range: `joinedAt <= to` and (`leftAt` null or `> to`); joined and left counted inside the range; unique people across ministries; share = unique serving divided by people not Inactive |
| Events | Events starting in range; registered = not cancelled registrations; checked in = event check-ins; turnout and fill are null when the divisor is 0 or capacity is unset |
| Rooms | Approved bookings overlapping the range, clipped to it; hours to 2 decimals; utilization = booked hours divided by (days times 14); estimated value = hours times hourly rate, null when no rate |

### 3.4 Web (`web/src/features/reports/`, `web/src/app/(admin)/reports/`)

- One page with tabs per kind, a range form (from, to, branch for church-wide users), summary stat line, and a table rendered from `columns`.
- Filters live in the URL query so a report link is shareable.
- CSV: `fetch` with credentials, read as a blob, save through a temporary object URL.
- PDF: `window.print()` with `@media print` rules that hide the sidebar, header, and controls, and print the title with range and branch. No server PDF library: no new dependency, and it matches how check-in tags print.
- Dashboard: "Rooms today" card from `GET /rooms` (it already returns today's approved bookings per room); `roomUsageToday` marks each booking done, active, or waiting.
- Landing: `app/page.tsx` fetches `/public/landing` in a cached server function, validates it, and `mergeLanding` lays it over the written copy; any failure keeps the copy.

## 4. Test Plan

### 4.1 Process

Strict Red-Green-Refactor: write a failing test, make it pass with the least code, then clean up. No production code without a failing test first.

### 4.2 Levels

| Level | Tool | Where | Covers |
|---|---|---|---|
| Unit (domain) | Vitest | `packages/shared/src/*.test.ts` | Schemas, pure rules, builders, CSV |
| Unit (service) | Vitest with Prisma mock | `api/src/**/*.service.test.ts` | Scoping, queries asked for, error codes, audit calls |
| HTTP | Vitest with Supertest | `api/src/app.http.test.ts`, `api/src/docs/api-docs.test.ts` | Guards, status codes, OpenAPI route list |
| Database | Vitest against Postgres | `packages/database` | Constraints and seed integrity |
| Component | Vitest with Testing Library | `web/test/**/*.test.{ts,tsx}` (mirrors `web/src`, imports through `@/`) | Forms, rendering, formatters, palette rule |
| End to end | Playwright (planned) plus manual browser checks | ports 3002 and 4000 | Real flows |

### 4.3 Phase 7 cases

Shared:
- `reportQuerySchema` rejects bad dates, `to` before `from`, and ranges over 366 days; accepts empty input.
- `reportRange` defaults to 12 weeks ending today in church time and converts to local midnight.
- Each builder: rows in date or name order, summary equals the sum of rows, empty input gives zero summary and no rows, nulls for divide-by-zero.
- Room builder clips bookings to the range and ignores bookings fully outside it.
- `toCsv` quotes commas, quotes, and newlines; prefixes `'` on `=`, `+`, `-`, `@`, tab, and carriage return; leaves negative numbers as numbers.

API:
- Branch user asking for another branch is pinned to their own branch.
- Unknown kind returns 400; missing `reports.read` returns 403.
- CSV route sets content type and filename and records `reports.export` without row data.
- Public landing returns public fields only, active records only, the next 7 days of services, and works without a session.
- Room usage today (web) lists only booked rooms, in-use rooms first, with each booking done, active, or waiting.
- OpenAPI lists the new routes.

Web:
- Report table renders columns and rows from a `Report`; empty state when no rows.
- Range form writes filters to the URL.
- Ink palette test still passes (no hue classes).

### 4.4 Commands

```
pnpm --filter @cms/shared test
pnpm --filter @cms/database test
pnpm --filter @cms/api test
pnpm --filter @cms/web test
pnpm -r typecheck
pnpm --filter @cms/web lint
pnpm build
```

### 4.5 Definition of done

All tests pass, typecheck, lint, and build pass, Scalar docs list every route, ROADMAP and README updated, and the feature checked in the browser at desktop and 375 pixels wide.
