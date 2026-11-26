# Handoff: Church Management System, Phase 6 and E-ink Admin Redesign

2026-11-25 · State snapshot after Phase 6 (attendance and check-in), room hourly rates, landing page motion, and the e-ink paper restyle of the admin app.

## 1. Objective

Build a church management system (one church, multiple branches) with a public landing site and an admin app. Phases 1 to 6 are done; Phase 7 (dashboard and reports) is next.

## 2. Current State

- pnpm monorepo at `C:\Users\admin\Desktop\cms`. Not a git repository. Nothing committed.
- Last full check: 494 tests pass (shared 122, database 34, api 219, web 119); web and api typecheck, web lint, and `pnpm build` pass.
- Database: local PostgreSQL on port 5433, database `cms`, 11 migrations applied, seeded (Phase 6 adds 36 services and 133 check-ins; rooms carry hourly rates).
- Dev servers: API on port 4000, web on port 3002, started through the app's preview panel from `.claude/launch.json`. The API `start:dev` script has no watch mode: restart it after any API change.
- Local test data left by browser checks: check-ins for Grace Park, Rosa Diaz, Isabel Cruz, and Ada Okafor (collected) on the upcoming Main Campus 9 AM service; 3 check-ins on the Community Food Drive event.
- Previous snapshot: `docs/handoffs/2026-11-24-church-cms-phases-1-to-5.md` (still valid for Phases 1 to 5).

| Area | Delivered |
|---|---|
| Phase 6 | Services with usher headcount, member and guest check-in for services and events, kids check-in with guardian and pickup code, checkout with code and guardian check, 5-try lock, override with reason, weekly trend, member attendance card |
| Rooms | `hourlyRate` (pesos) in schema, form, list, and detail |
| Landing | Slow looping gallery carousel with Pause, scroll entrances per section, one signature pickup-diagram animation |
| Admin restyle | E-ink paper look, new sidebar and header bar, Ctrl+K module search, ink status glyphs, IBM Plex fonts, page entrance cascade |

## 3. Key Decisions and Rationale

- Admin is light "e-ink paper" only, IBM Plex Sans and Plex Mono, ink glyphs instead of status colors, red only for failures: user chose all three in answer to direct questions; this replaced the earlier Inter and Plus Jakarta Sans choice.
- `StatusGlyph` vocabulary (done = filled dot, active = half ring, waiting = empty ring, off = dashed ring, failed = red): taken from the user's e-ink design brief so state never depends on hue.
- `src/lib/ink-palette.test.ts` fails on any Tailwind hue class outside the landing page: keeps the no-color rule from eroding.
- Shadow utilities set to nothing in `@theme`: brief demands zero drop shadows; focus rings use `ring-*` and still work.
- Pickup codes: 5 characters from `ACDEFGHJKMNPQRTUVWXY34679`, drawn with `crypto.randomInt`, compared in constant time, shown once, never listed, redacted in the audit log (key pattern `/pickup/i`): ROADMAP security note requires pickup codes and guardian verification.
- Guardian rule: recorded guardian or household HEAD or SPOUSE; a non-member guardian must give a phone and is matched by the name given at check-in: same security note.
- New permission `attendance.override` for Super Admin, Branch Admin, Pastor: releasing a child without a code needs a higher role and an audited reason.
- Reported attendance = usher headcount, never fewer than check-ins: headcount covers people who do not check in.
- `hourlyRate` as `DECIMAL(10,2)`, returned by the API as a number: money to the centavo; Prisma Decimal would otherwise serialize as a string.
- Sample room rates match the landing page plans (Sanctuary 6000, Fellowship Hall 2500, Classroom A 500): keeps public prices and admin data consistent.
- Gallery carousel has a Pause button and stops on hover, focus, and off screen; reduced motion shows a still grid: motion rules require a pause control for motion longer than 5 seconds.
- `min-w-0` on `SidebarInset`: wide tables pushed every admin page wider than the screen.

## 4. Dead Ends (Do Not Retry)

- Inline `node -e` or heredoc scripts containing apostrophes in Git Bash: quoting breaks. Use the Write tool or a heredoc with `<<'EOF'` fed to `node -`.
- Regex replacement of seed room rows by name: failed silently on the data file; line-by-line matching worked.
- `ring-dashed` in Tailwind: not a real utility; use `border border-dashed`.
- A JSX comment placed before the root element inside `return (`: TypeScript parse error; put the comment above `return`.
- `migrate dev` alone after a schema change: Prisma 7 does not regenerate the client; run `db:generate` too.
- Killing processes on port 3000: belongs to the user's `pms` project. Never touch it.

## 5. Artifacts and File Changes

All paths verified on disk at snapshot time. Status: completed unless noted.

- `packages/shared/src/attendance.ts` (+ test): pickup codes, `ageOn`, `isLikelyChild`, `summarizeCheckIns`, `reportedAttendance`, `weekStartKey`, service and check-in schemas
- `packages/shared/src/events.ts`: `hourlyRate` on room schemas; `permissions.ts`: `attendance.override`
- `packages/database/prisma/migrations/20261125004726_attendance`, `20261125004731_attendance_constraints`, `20261125014946_room_hourly_rate`
- `packages/database/seed/data/attendance.ts`, `seed/seeders/attendance.ts`; `seed/data/members.ts` (kids Miguel Santos, Ada Okafor); `seed/data/rooms-events.ts` (rates)
- `api/src/attendance/` (`check-in.service.ts`, `services.service.ts`, `attendance.controller.ts`, tests); `api/src/rooms/rooms.service.ts` (`withRate`)
- `web/src/features/attendance/` (board, forms, trend, print tag, member card); `web/src/app/(admin)/attendance/`
- `web/src/features/landing/gallery-carousel.tsx`, `reveal.tsx`, `photo-placeholder.tsx`
- `web/src/features/rooms/format.ts`, `room-form.tsx`
- `web/src/components/status-glyph.tsx`, `components/admin/admin-shell.tsx`, `nav-items.ts`, `quick-search.tsx`
- `web/src/app/globals.css` (tokens, `font-data`, `micro-label`, `ink-grain`, `.ink-page`), `app/layout.tsx` (Plex fonts), `app/providers.tsx` (forced light), `app/(admin)/template.tsx`
- `web/src/lib/ink-palette.test.ts`; `web/vitest.setup.ts` (IntersectionObserver stub)
- `docs/ROADMAP.md`, `README.md`: updated for Phase 6, rates, landing motion, admin style

## 6. Verbatim Essentials and Constraints

- Database: host localhost, port 5433, user `postgres`, database `cms`. Password only in `api/.env`; never print or copy it.
- Seed admin `admin@cms.local`; passwords in `api/.env` (`SEED_ADMIN_PASSWORD`, `SEED_SAMPLE_PASSWORD`).
- Ports: API 4000, web 3002, port 3000 is the user's `pms` backend.
- Admin palette: paper `#f4f1ea`, raised `#faf8f3`, sunk `#ece8df`, ink `#141310`, secondary ink `#69675f`, hairline `#d6d3cc`, signal red `#c8321e`.
- Pickup: code length 5, `MAX_PICKUP_ATTEMPTS` 5, lock returns HTTP 423. Child age cutoff 12 (`CHILD_MAX_AGE`).
- Attendance week buckets start on the Manila Sunday (UTC+8, `weekStartKey`).
- Hourly rate: 0 to 1,000,000 pesos, at most two decimals; blank clears it.
- Database commands from repo root: `pnpm db:migrate`, `db:migrate:create`, `db:generate`, `db:deploy`, `db:status`, `db:seed`, `db:reset` (destroys data), `db:studio`.

## 7. Working Preferences and Writing Rules

- Caveman mode, tier ultra, in chat. Never compress code, commands, paths, errors, negations.
- English, present tense, active voice. No emojis, no em dashes, no Latin abbreviations.
- Strict Red-Green-Refactor TDD; Zod at every boundary; no hardcoded secrets; never log secret values.
- Keep docs current every change: Scalar route list in `api/src/docs/api-docs.test.ts`, `docs/ROADMAP.md`, `README.md`.
- Admin UI: no hue classes, state through `StatusGlyph`, numbers in `font-data`, labels in `micro-label`, icons only from `@/components/icons`, motion from `@/components/motion` or landing `reveal.tsx`.
- Verify in the browser before calling work done. Ask the user when a design choice is genuinely theirs.
- Commit only when the user asks.

## 8. Open Items and Immediate Next Steps

- Next action: Phase 7, dashboard and reports (attendance, membership growth, ministry participation, event turnout, room utilization; CSV and PDF export).
- Open from the restyle: native `<select>` controls do not match the e-ink style; color contrast not measured with a tool; one unexplained session sign-out during browser checks.
- Not built: booking cost estimates from `hourlyRate`, room hire invoicing, self check-in kiosks, label printer integration, ministry attendance.
- Deferred: member CSV import, custom fields, member photos, whole-series event edits, report cards, printable registers.
- Blocked: limiting ministry leaders and teachers to their own ministries and classes. Unblocked by linking user accounts to member records.
- Offered, not done: initialize git and make a first commit (awaiting the user).

## 9. Suggested Opening Prompt for Next Session

```
Read docs/handoffs/2026-11-25-church-cms-phase-6-and-ink-redesign.md, docs/ROADMAP.md, README.md,
and CLAUDE.md in C:\Users\admin\Desktop\cms. Phases 1 to 6 are done (494 tests passing) and the admin
uses the e-ink paper style. Start Phase 7: dashboard and reports. Follow the same conventions: shared
Zod schemas in packages/shared, tables and seeders in packages/database, strict TDD, Scalar docs kept
current, no hue classes in admin code (StatusGlyph for state, font-data for numbers), Rune Icons through
@/components/icons, motion animations, and verify in the browser on ports 4000 (api) and 3002 (web).
Restart the API after API changes. Do not touch port 3000.
```
