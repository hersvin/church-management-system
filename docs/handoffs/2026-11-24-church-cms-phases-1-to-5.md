# Handoff: Church Management System, Phases 1 to 5

2026-11-24 · State snapshot of the church management system after Phases 1 to 5, ready for Phase 6 (attendance and check-in).

## 1. Objective

Build a church management system (one church, multiple branches) with a public landing site and an admin app covering members, ministries, rooms, events, school, attendance, users, reports, dashboard, and configuration. Phases 1 to 5 are done; Phase 6 is next.

## 2. Current State

- pnpm monorepo at `C:\Users\admin\Desktop\cms`. Not a git repository. Nothing committed.
- Last full check: 373 tests pass (shared 93, database 27, api 186, web 67); typecheck, web lint, and `pnpm build` pass.
- Database: local PostgreSQL on port 5433, database `cms`, 8 migrations applied, seeded with sample data for every finished module.
- Dev servers: API on port 4000 and web on port 3002, started from `.claude/launch.json` through the app's preview panel. Scalar API reference at http://localhost:4000/docs.
- Roadmap status table: `docs/ROADMAP.md` (Phases 1 to 5 Done, Phase 6 Next).

| Phase | Scope delivered |
|---|---|
| 1 Foundation | Auth (JWT in httpOnly cookie), users, 7 roles with permissions, branches, settings, audit log |
| 2 Members | Members, households, status history, soft archive, dashboard stats |
| 3 Ministries | Ministries, volunteer roles, rosters (leader, co-leader, member) with history |
| 4 Rooms and events | Rooms, booking requests and approval, conflict engine, repeating events, registrations, month calendar |
| 5 School | Terms, classes, teachers, enrollment, sessions, attendance taking, attendance rates |

## 3. Key Decisions and Rationale

- Stack Next.js + NestJS + PostgreSQL + Prisma: user chose it.
- Tenancy "one church, multi-branch": user chose it. Non church-wide users are pinned to their own branch (`api/src/common/branch-scope.ts`).
- Extra module "Attendance + check-in" (Phase 6): user chose it; giving, communications, prayer care were not chosen.
- Web stack shadcn/ui on Base UI, zustand, TanStack Query, Tailwind CSS, Vitest: user request.
- Rune Icons (`runeicons-react`, pinned 0.1.1) instead of lucide-react: user request. Wrapped in `web/src/components/icons.tsx` because Rune components accept only `size`; the wrapper clones the svg to add `className` and `aria-label`.
- Fonts Inter (body, `font-sans`) and Plus Jakarta Sans (headings, `font-heading`): user asked for two good-looking Google fonts.
- Scalar API reference generated from controllers and shared Zod schemas on every boot: user asked to keep the API docs updated. `api/src/docs/api-docs.test.ts` fails if a route is missing.
- `packages/database` holds schema, migrations, client, and seeders: user request ("create a folder database on packages... that you can command on the backend side").
- Animations with `motion`, honoring the OS reduced-motion setting: user asked for animation.
- Zod schemas shared in `packages/shared`: same validation in API, web forms, and docs.
- Soft deletes (`deletedAt`) and history rows (`leftAt`, `droppedAt`, status history): keep history for audit and reporting.
- Postgres exclusion constraint on approved room bookings: race-safe; app check alone can be beaten by concurrent requests.
- Repeating events stored as one row per date with `seriesId` (max 52): simple conflict checks and per-date edits.
- Admin pages split into `page.tsx` (server, `export const instant = false`) and `view.tsx` / `detail-view.tsx` (client): Next 16 instant-navigation validation errors and a build failure on dynamic routes otherwise.
- Times stored in UTC; repeat math in UTC: exact for Asia/Manila (no daylight saving).
- API calls from web go through the Next rewrite `/api/*`: keeps the session cookie first-party.

## 4. Dead Ends (Do Not Retry)

- Heredoc-heavy or apostrophe-containing inline `node -e` scripts in Git Bash: quoting breaks. Write scripts to the scratchpad and run them.
- Plain wrapper `<span>` around Rune icons: conflicts with shadcn `[&_svg]:size-4` rules; use the cloneElement wrapper.
- Layout-level `instant = false` alone: does not cover sibling navigation; each admin page needs its own server `page.tsx` with `instant = false`.
- `useParams` / `usePathname` outside Suspense on dynamic routes: build fails; wrap the admin shell and detail views in Suspense.
- `JSON.stringify(error, ownPropertyNames)` to detect the overlap violation: misses nested `meta`; use the recursive `isOverlapViolation`.
- Zod refine that builds a Date from unvalidated strings: Zod still runs refines after a failed format check, so it threw; guard with `Number.isNaN`.
- Prisma 8 RC CLI with client 7.10.1: mismatch; Prisma CLI and client pinned to 7.10.1.
- Killing processes on port 3000: that port belongs to the user's other project (`pms`). Never touch it.

## 5. Artifacts and File Changes

All paths verified on disk at snapshot time.

- `docs/ROADMAP.md`: completed, kept current per phase
- `README.md`: completed (setup, run, checks, conventions, database commands)
- `packages/shared/src/`: completed (`permissions`, `schemas`, `fields`, `members`, `ministries`, `scheduling`, `events`, `school` with tests)
- `packages/database/prisma/schema.prisma`, `prisma/migrations/` (8 migrations), `prisma.config.ts`, `src/index.ts`, `src/env.ts`: completed
- `packages/database/seed/index.ts`, `seed/seeders/{core,members,ministries,rooms-events,school}.ts`, `seed/data/*.ts`, `seed/data.test.ts`: completed
- `api/src/` modules: `auth`, `users`, `branches`, `settings`, `audit`, `members`, `ministries`, `rooms`, `events`, `school`, `docs`: completed
- `web/src/app/(admin)/`: dashboard, members, households, ministries, events, rooms, school, users, branches, settings, audit: completed
- `web/src/components/icons.tsx`, `motion/index.tsx`, `member-picker.tsx`, `conflict-alert.tsx`, `ui/native-select.tsx`: completed
- `web/src/app/page.tsx`: placeholder landing page (full landing site is Phase 8)
- `.claude/launch.json`: completed (api port 4000; web configured 3001, runs on 3002)
- `api/.env`: present, gitignored, holds DATABASE_URL, JWT secret, seed passwords. Do not print or copy values.

## 6. Verbatim Essentials and Constraints

- Database: host localhost, port 5433, user `postgres`, database `cms`. Password lives only in `api/.env` (URL-encoded inside `DATABASE_URL`).
- Seed admin: `admin@cms.local`; sample users `*@cms.local`. Passwords in `api/.env` as `SEED_ADMIN_PASSWORD` and `SEED_SAMPLE_PASSWORD`.
- Ports: API 4000, web 3002, port 3000 is the user's `pms` backend.
- Timezone: Asia/Manila (UTC+8). Web tests pin `TZ: "Asia/Manila"` in `web/vitest.config.mts`.
- Attendance rate = (PRESENT + LATE) / (PRESENT + LATE + ABSENT), whole percent; EXCUSED excluded; null when nothing countable.
- Booking overlap is half-open: back-to-back bookings are allowed.
- Max event series length: 52 occurrences. Calendar list range: max 120 days. Booking max 24 hours; event max 14 days.
- Database commands (from repo root or `pnpm --filter @cms/api ...`): `db:migrate`, `db:migrate:create`, `db:deploy`, `db:status`, `db:seed`, `db:reset` (destroys data), `db:generate`, `db:studio`.
- After any `pnpm add` or `pnpm remove`, restart the Next dev server (its store path changes and it breaks).

## 7. Working Preferences and Writing Rules

- Caveman mode, tier ultra, in chat replies. Never compress code, commands, paths, error messages, negations.
- Present tense, active voice, English. No emojis. No em dashes. No Latin abbreviations (write "for example", "that is").
- Strict Red-Green-Refactor TDD: write the failing test, confirm it fails, then implement.
- Zod validation at every boundary. No hardcoded secrets; never log or display secret values.
- Keep docs updated every phase: Scalar docs (add `@ApiProtected`, `@ZodBody`, `@ZodQuery`, and paths to `api-docs.test.ts`), `docs/ROADMAP.md` status, README.
- New icons only through `@/components/icons`; after `npx shadcn add`, replace its lucide imports.
- New tables in `packages/database/prisma/schema.prisma`; new seed data in `seed/data/<area>.ts` plus a seeder in `seed/seeders/<area>.ts` registered in `seed/index.ts`. Seeders must be idempotent.
- New admin screens use the motion primitives (`FadeIn`, `Stagger`, `MotionTableBody`, `AnimatedNumber`).
- Verify in the browser (preview panel) before calling a phase done.
- Commit only when the user asks; the folder has no git repository yet.

## 8. Open Items and Immediate Next Steps

- Next action: Phase 6, attendance and check-in (service attendance, kids check-in with pickup codes and guardian verification, event check-in), feeding the dashboard and reports.
- Then: Phase 7 dashboard and reports, Phase 8 public landing site and visitor forms, Phase 9 mobile app.
- Deferred: member CSV import, custom fields, member photos, whole-series event edits, report cards, printable registers.
- Blocked: limiting ministry leaders and teachers to their own ministries and classes. Unblocked by linking user accounts to member records.
- Offered, not done: initialize git and make a first commit (awaiting the user's go-ahead).

## 9. Suggested Opening Prompt for Next Session

```
Read docs/handoffs/2026-11-24-church-cms-phases-1-to-5.md, docs/ROADMAP.md, README.md, and CLAUDE.md in C:\Users\admin\Desktop\cms.
Phases 1 to 5 of the church management system are done (373 tests passing). Start Phase 6: attendance and check-in
(service attendance, kids check-in with pickup codes and guardian verification, event check-in).
Follow the same conventions: shared Zod schemas in packages/shared, tables and seeders in packages/database,
strict TDD, Scalar docs kept current, Rune Icons through @/components/icons, motion animations,
and verify in the browser on ports 4000 (api) and 3002 (web). Do not touch port 3000.
```
