# Church Management System: Decisions and Roadmap

## Decisions

| Area | Choice |
|---|---|
| Frontend | Next.js (App Router, TypeScript) in `web/`: public landing site and admin app |
| Backend | NestJS REST API in `api/` |
| Database | PostgreSQL with Prisma ORM, kept in `packages/database` (schema, migrations, client, seeders) |
| Validation | Zod at every boundary (shared schemas package) |
| Tenancy | One church, multiple branches (campuses) |
| Mobile | React Native (Expo) in `mobile/`, later phase |
| Testing | Red-Green-Refactor TDD: Vitest unit, Supertest API, Playwright end to end (planned) |
| API docs | Scalar reference at `/docs`, OpenAPI at `/openapi.json`, generated from controllers and shared Zod schemas on every boot |
| Web UI | shadcn/ui (Base UI), Tailwind CSS 4, TanStack Query, zustand, motion (animations honor reduced motion), Rune Icons; admin in an e-ink paper style with IBM Plex Sans and IBM Plex Mono; public site in Host Grotesk and IBM Plex Mono |

## Modules

| Module | Scope |
|---|---|
| Landing (public) | Hero, service times, upcoming events, ministries, contact and map, "I'm new" visitor form, prayer request form |
| Dashboard | Attendance trend, member totals and new members, upcoming events, room usage today |
| Members | Profiles, households, status (visitor, regular, member), membership and baptism dates, custom fields, CSV import |
| Ministries | Groups, leaders, rosters, schedules, volunteer roles |
| Events | Calendar, recurring events, registration and RSVP, capacity, link to room booking |
| Rooms | Catalog (capacity, equipment), booking requests and approval, conflict detection, calendar view |
| School | Classes, teachers, terms, enrollment, class attendance, progress |
| Attendance and check-in | Service attendance, kids check-in with pickup codes, event check-in |
| Users | Accounts, invites, role-based access control, audit log |
| Reports | Attendance, membership growth, ministry participation, event turnout, room utilization; CSV and PDF export |
| Configuration | Church and branch profiles, branding, service times, custom fields, email templates, roles |

## Roles

Super Admin, Branch Admin, Pastor, Ministry Leader, Teacher, Staff, Member, Public Visitor (unauthenticated).

## Core Entities (draft)

- `Branch`, `User`, `Role`, `Permission`, `AuditLog`
- `Person`, `Household`, `MemberStatusHistory`, `CustomField`, `CustomFieldValue`
- `Ministry`, `MinistryMember`, `MinistryRole`
- `Event`, `EventOccurrence`, `EventRegistration`
- `Room`, `RoomBooking`
- `SchoolTerm`, `SchoolClass`, `Enrollment`, `ClassSession`
- `Service`, `AttendanceRecord`, `CheckIn`
- `VisitorSubmission`, `PrayerRequest`, `Setting`

Every branch-scoped entity carries `branchId`.

## Phases

| Phase | Status |
|---|---|
| 1. Foundation | Done |
| 2. Members and households | Done (CSV import and custom fields deferred) |
| 3. Ministries | Done |
| 4. Rooms and events | Done |
| 5. School | Done |
| 6. Attendance and check-in | Done |
| 7. Dashboard and reports | Done |
| 9. Mobile app | First version built |

1. Foundation: monorepo, shared Zod schemas, Prisma schema, auth (JWT in httpOnly cookie), users, roles, branches, configuration, audit log
2. Members and households: directory with search and status filter, profiles, status history, households, soft archive, dashboard stats
3. Ministries: ministries per branch with categories and schedules, volunteer roles, rosters (leader, co-leader, member), participation history, dashboard stats
4. Rooms and events: rooms, booking requests with approval, one shared conflict engine, repeating events (weekly, every 2 weeks, monthly), registrations with capacity, month calendar
5. School: terms, classes with weekly schedules, lead and assistant teachers, enrollment (completed with grade, or dropped), dated sessions, attendance taking, attendance rates
6. Attendance and check-in: worship services with usher headcounts, member and guest check-in for services and events, kids check-in with guardians and pickup codes, weekly attendance trend on the dashboard, attendance history on member profiles
7. Dashboard and reports: five reports (attendance, membership growth, ministry participation, event turnout, room utilization) over a date range and branch, CSV export with formula-injection guard, PDF through the print dialog, rooms in use today on the dashboard; public landing data endpoint feeding the landing page
8. Public landing site and visitor forms
9. Mobile app: Expo SDK 58 app for members and staff: sign in, home, services, QR self check-in, usher scanning of member cards, member QR card, ministries with ask-to-join, events with registration, profile and attendance history

## Security Notes

- Member records are personal data: restrict by role and branch, log every change, never log personal fields unredacted.
- Kids check-in requires pickup codes and guardian verification.
- Public forms need rate limiting and spam protection.

## Phase 2 Notes

- Entities: `Household`, `Member`, `MemberStatusHistory` (enums `MemberStatus`, `Gender`, `CivilStatus`, `HouseholdRole`).
- Records are archived with `deletedAt`, never hard deleted.
- Branch users only see and change records in their own branch. A household must be in the same branch as its members.
- Deferred to a later phase: CSV import, custom fields, member photos, member self-service portal.

## Phase 3 Notes

- Entities: `Ministry`, `MinistryRole`, `MinistryMember` (enums `MinistryCategory`, `MinistryPosition`).
- Leaving a roster sets `leftAt`; past service shows on the member profile. A partial unique index allows one active roster entry per person per ministry.
- Archiving a ministry ends every active roster entry. Inactive ministries cannot take new people.
- A person can only join ministries in their own branch.
- Not yet: limiting ministry leaders to editing only the ministries they lead (needs user accounts linked to member records), ministry attendance (Phase 6), and ministry events (Phase 4).

## Phase 4 Notes

- Entities: `Room`, `RoomBooking`, `Event`, `EventRegistration` (enums `BookingStatus`, `EventCategory`, `EventStatus`).
- Conflict engine: `packages/shared/src/scheduling.ts` (overlap and repeat expansion, shared by API and web) plus `api/src/rooms/availability.ts` (409 with every clash). Postgres enforces it too: an exclusion constraint on approved bookings (`btree_gist`, half-open ranges, so back-to-back is allowed).
- Booking rules: people with `rooms.manage` are approved immediately; others create pending requests. Approval re-checks clashes. Attaching a room to an event needs `rooms.book`.
- Repeating events are stored as one row per date sharing a `seriesId` (at most 52). Editing changes one date; cancelling covers "this date" or "this and following".
- Times are stored in UTC and shown in the viewer's timezone. Repeat math runs in UTC, which is exact for Asia/Manila (no daylight saving). A church in a daylight-saving timezone would need timezone-aware repeats.
- Rooms carry an hourly hire rate in pesos (`hourlyRate`, Postgres `DECIMAL(10,2)`, never negative). The API returns it as a number; blank means no rate is set. Sample rates match the room hire plans on the public site.
- Not yet: public self-registration (Phase 8), check-in (done in Phase 6), editing a whole series at once. Booking cost estimates and invoicing for room hire are not built.

## Phase 5 Notes

- Entities: `SchoolTerm`, `SchoolClass`, `ClassTeacher`, `Enrollment`, `ClassSession`, `SessionAttendance` (enums `ClassAudience`, `TeacherRole`, `EnrollmentStatus`, `AttendanceStatus`).
- Attendance rate = (present + late) / (present + late + absent); excused sessions are left out. One shared function (`attendanceRate` in `packages/shared`) is used by the API and web.
- A session's register is every student not dropped before its date, so earlier sessions can be filled in for late joiners.
- Database guards: one active enrollment per student per class (partial unique index), one session per class per date, valid term ranges and meeting days.
- Terms and session dates are calendar dates (Postgres DATE).
- Not yet: limiting teachers to their own classes (needs user accounts linked to members), report cards, and printing registers.

## Database Package

`packages/database` holds the Prisma schema, every migration, the generated client (`@cms/database`), and the seeders (one per area under `seed/seeders`, data under `seed/data`). The API imports the client from it and exposes `db:*` scripts (see README).

## Phase 6 Notes

- Entities: `Service`, `CheckIn` (enum `CheckInKind`: `ATTENDEE`, `CHILD`). A check-in belongs to exactly one service or one event and names a member or a guest (database CHECK constraints). A member checks in once per service and once per event (partial unique indexes).
- Reported attendance = the usher headcount, but never fewer than the check-ins. Weekly totals group by the Manila Sunday that starts the week (`weekStartKey` in `packages/shared`).
- Pickup codes: 5 characters from `ACDEFGHJKMNPQRTUVWXY34679` (no look-alikes), drawn with `crypto.randomInt`, unique among children still in care at the same gathering. Shown once at check-in; never in list responses; the audit log redacts keys matching `pickup`. Codes are compared in constant time.
- Guardian rules: a child may be collected by the guardian recorded at check-in or by a household head or spouse. A non-member guardian must give a phone number and is matched by the name given at check-in.
- Five wrong codes lock the check-in (HTTP 423). `attendance.override` (Super Admin, Branch Admin, Pastor) releases a child without the code, with a reason that is audited.
- A mistaken check-in can be removed; a collected child's record is kept.
- Not yet: self check-in kiosks, label printer integration (tags print through the browser), and ministry or small-group attendance.

## Phase 7 Notes

- Specs: `docs/PRD.md` (requirements R1 to R12), `docs/TDD.md` (design and test plan), `docs/DDD.md` (Reporting context).
- One report shape for every kind (`{ kind, from, to, branchId, columns, rows, summary }`), built by pure functions in `packages/shared/src/reports.ts` and fed by grouped, date-filtered queries in `api/src/reports`.
- Ranges use church local days (UTC+8). Default: 12 weeks ending today. Maximum: 366 days.
- PDF uses the browser print dialog instead of a server PDF library: no new dependency, same approach as check-in tags.
- "Rooms today" reuses `GET /rooms`, which already returns each room's approved bookings for today.
- Public data: `GET /public/landing` (unauthenticated, 60 requests a minute, `Cache-Control: public, max-age=300`) returns church settings, active branches with the next 7 days of services, active ministries, and active rooms that have a rate. It selects public fields only.
- Calendar image editor at `/events/design`: canvas-drawn month calendar with styles, palettes, editable colors and fonts, three layouts, three sizes, per-image renames and hides, PNG download. Edits are not saved between visits.
- Not yet: scheduled or emailed reports, per-branch open hours for utilization, events on the landing page, saved calendar image designs.

## Mobile App Notes

- Accounts link to member records (`User.memberId`, unique). Linking or unlinking revokes the account's sessions and QR cards.
- QR tokens are signed with a key derived from `JWT_SECRET`, carry a type (service or member) and an expiry, and are compared in constant time. Member cards also carry the account's token version.
- Self check-in opens three hours before a service; service codes expire six hours after the start.
- Join requests: `MinistryJoinRequest` (pending, approved, declined), at most one pending request per member and ministry (partial unique index). Approval adds the member to the roster in the same transaction.
- `/me/*` routes return only the signed-in person's own data and public details.
- Profile self-edit: `PATCH /me/member` accepts email, phone, address, occupation, birthday, gender, and civil status only (strict schema), and is audited as `member.self_update`.
- Roles (2026-11-26): ADMIN, PASTOR, STAFF. Migration `20261126040000_three_roles` keeps every account: Super Admin becomes ADMIN, Branch Admin joins ADMIN, every other role joins STAFF; admins and pastors are church-wide. Sample ministries are now Multimedia, Worship, Dance, Usher; the seed retires the earlier ones (events move, rosters end, soft delete).
- Profile photos live in `UserPhoto` (one per account, bytes in Postgres, 512 KB cap), so staff without a member record get one too.
- Ushers are staff in the Usher ministry: the Scan tab becomes their camera; everyone else gets their QR card there.
- Videos play in the app through the official YouTube embed, which counts as channel views.
- Music Library: tables `Song`, `Playlist`, `PlaylistSong` (migration `20261126060000_music_library`). Playlist songs copy the original key so later library edits do not shift a saved set. Song charts (`Song.chart`, migration `20261126080000_song_chart`) are entered by the team and transposed on the phone. Not yet: a web admin page, minor keys, and Nashville numbers.
- Not yet: push notifications, kids pickup codes on the guardian's phone, cancelling an event registration from the app, offline mode.
