# Domain Model (DDD): Church Management System

How the business is split into bounded contexts, the words each context uses, the aggregates that guard its rules, and how contexts depend on each other. Code paths name where each piece lives.

## 1. Bounded Contexts

| Context | Purpose | Shared schemas | API module | Web feature |
|---|---|---|---|---|
| Identity and Access | Users, roles, permissions, sessions, audit | `permissions.ts`, `schemas.ts` | `auth`, `users`, `audit` | `features/admin`, `features/auth` |
| Organization | Branches and settings | `schemas.ts` | `branches`, `settings` | `features/admin` |
| People | Members, households, status journey | `members.ts`, `fields.ts` | `members` | `features/members` |
| Ministries | Ministries, volunteer roles, rosters | `ministries.ts` | `ministries` | `features/ministries` |
| Scheduling | Rooms, bookings, events, registrations | `events.ts`, `scheduling.ts` | `rooms`, `events` | `features/rooms`, `features/events` |
| School | Terms, classes, enrollment, sessions | `school.ts` | `school` | `features/school` |
| Attendance | Services, check-ins, kids care | `attendance.ts` | `attendance` | `features/attendance` |
| Reporting | Read-only answers across contexts | `reports.ts` | `reports` | `features/reports` |
| Public site | Read-only public view of branches, services, ministries, rooms | `public.ts` | `public` | `features/landing` |

## 2. Context Map

```
Identity and Access  ──(actor, permissions, branch)──▶ every context
Organization         ──(branchId)──────────────────▶ every branch-scoped context
People               ──(member)────────▶ Ministries, School, Attendance, Scheduling (registrations)
Scheduling           ──(room, event)───▶ School (class room), Attendance (event check-in)
All contexts         ──(read models)───▶ Reporting   (downstream, conformist, never writes)
Organization, Attendance, Ministries, Scheduling ──(public fields)──▶ Public site (downstream, never writes)
```

- Reporting is a downstream conformist: it reads other contexts' tables and applies their rules (for example `reportedAttendance` from Attendance). It never changes data.
- Branch scoping is a shared kernel: `branchFilter` and `assertBranchAccess` in `api/src/common/branch-scope.ts`.

## 3. Ubiquitous Language

| Term | Meaning |
|---|---|
| Branch | One campus of the church. Every scoped record carries `branchId`. |
| Church-wide user | A user with no branch; sees all branches. |
| Person / Member | A row in `Member`. "Member" is also a status; context makes it clear. |
| Status | Journey stage: Visitor, Regular, Member, Inactive. Every change is kept in status history. |
| Household | People living together; head, spouse, child, other. |
| Ministry | A serving group, for example worship or ushers. |
| Roster | The people in a ministry; leaving sets `leftAt`, history stays. |
| Booking | A room request; pending, approved, rejected, cancelled. Only approved bookings hold the room. |
| Conflict | Two approved holds on one room that overlap in time. |
| Event | A dated gathering; may repeat as a series; may need registration and have a capacity. |
| Service | A worship gathering with an usher headcount. |
| Check-in | One person present at one service or one event. |
| Reported attendance | Usher headcount, but never fewer than check-ins. |
| Child in care | A child checked in and not yet collected. |
| Pickup code | 5-character secret shown once at child check-in; needed to collect the child. |
| Override | Release of a child without the code, by a higher role, with an audited reason. |
| Report | A read-only table plus summary over a date range and optional branch. |
| Open hours | The bookable day used for utilization: 14 hours (7:00 to 21:00). |
| Utilization | Booked hours divided by open hours in the range. |
| Turnout | Check-ins divided by registrations for an event. |
| Fill | Registrations divided by capacity for an event. |

## 4. Aggregates and Invariants

| Aggregate (root) | Invariants |
|---|---|
| User | Email unique; disabled users cannot sign in; bumping `tokenVersion` ends sessions. |
| Member | Status change writes a history row; archive is soft (`deletedAt`); belongs to one branch. |
| Household | Members of a household share its branch. |
| Ministry (with roster) | A person holds at most one open roster row per ministry; leaving keeps the row. |
| Room (with bookings) | No two approved bookings overlap; hourly rate is 0 to 1,000,000 with 2 decimals. |
| Event (with registrations) | Registrations never exceed capacity; a cancelled event keeps its registrations. |
| School class (with enrollments and sessions) | One session per class per date; one attendance mark per enrollment per session. |
| Service (with check-ins) | A member checks in once per service; a check-in belongs to exactly one service or one event. |
| Child check-in | Collected only with the right code, by an allowed guardian, or by audited override; 5 wrong codes lock it. |

Database CHECK constraints and partial unique indexes back the most important invariants (see migrations in `packages/database/prisma/migrations`).

## 5. Domain Services (pure functions in `packages/shared`)

| Function | Context | Rule |
|---|---|---|
| `findOverlaps`, `expandOccurrences` | Scheduling | Conflict detection and repeating events |
| `generatePickupCode`, `normalizePickupCode` | Attendance | Pickup code alphabet and format |
| `reportedAttendance`, `weekStartKey` | Attendance | Headcount rule and Manila week buckets |
| `reportRange` | Reporting | Default and maximum date range |
| `buildAttendanceReport`, `buildMembershipReport`, `buildMinistryReport`, `buildEventReport`, `buildRoomReport` | Reporting | Turn raw rows into report rows and summary |
| `toCsv` | Reporting | Safe CSV with formula-injection guard |

Pure functions keep rules testable without a database and shared between API and web.

## 6. Domain Events (recorded in the audit log)

Each write records `action` plus `entity`: for example `members.create`, `members.update`, `bookings.approve`, `attendance.check_out`, `attendance.pickup_override`, and in Phase 7 `reports.export`. Changes are redacted for keys matching `password|token|secret|hash|pickup`.

## 7. Reporting Context Detail (Phase 7)

- Input: `ReportQuery` = `{ from?, to?, branchId? }`, resolved by `reportRange` to Manila local midnights.
- Output: `Report` = `{ kind, from, to, branchId, columns, rows, summary }`. One shape for every kind, so the web table, CSV, and print view stay generic.
- Kinds: `attendance`, `membership`, `ministries`, `events`, `rooms`.
- Reads only. Uses grouped counts and date-indexed filters; no per-row queries.
