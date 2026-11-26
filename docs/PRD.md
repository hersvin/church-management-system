# Product Requirements Document: Church Management System

Status: living document. Phases 1 to 7 shipped; Phase 7 (dashboard and reports) is specified in Section 6.

## 1. Problem

A church with several branches (campuses) tracks people, ministries, rooms, events, Sunday school, and attendance in spreadsheets and chat threads. Data drifts between branches, nobody sees totals, kids check-in has no pickup control, and leaders cannot answer simple questions ("how many attended last month?", "which rooms sit empty?") without manual counting.

## 2. Goals

- One system of record for people and church activity across all branches.
- Branch staff see and change only their own branch; church-wide leaders see everything.
- Safe kids check-in with pickup codes and guardian checks.
- Leaders answer attendance, growth, participation, turnout, and room-use questions in under a minute, and export the answer.
- A public landing site that brings new visitors in (Phase 8).

## 3. Non-goals

- Online giving and accounting.
- Livestreaming or sermon media hosting.
- Multi-church tenancy (one church, many branches only).
- A member self-service portal (later).

## 4. Users and Roles

| Role | Scope | Main jobs |
|---|---|---|
| Super Admin | All branches | Users, roles, branches, settings, everything else |
| Branch Admin | One branch or all | Runs a branch: people, rooms, events, reports |
| Pastor | One branch or all | Pastoral view of people, ministries, attendance, reports; releases a child without a code |
| Ministry Leader | One branch | Rosters, ministry events, room requests, check-in |
| Teacher | One branch | Classes, enrollment, class attendance |
| Staff | One branch | Read most modules, book rooms, run check-in, read reports |
| Member | Own data | Read events and ministries |
| Public visitor | None | Landing site and forms (Phase 8) |

Permission keys live in `packages/shared/src/permissions.ts`. Reports need `reports.read` (Super Admin, Branch Admin, Pastor, Staff).

## 5. Modules and Requirements

| Module | Requirement | Status |
|---|---|---|
| Foundation | Login with httpOnly cookie, role-based access, branch scoping, audit log of every change | Done |
| Members and households | Directory, search, status filter, profiles, status history, households, soft archive | Done (CSV import, custom fields deferred) |
| Ministries | Ministries per branch, categories, schedules, volunteer roles, rosters, participation history | Done |
| Rooms and events | Room catalog with hourly rate, booking requests with approval, conflict detection, repeating events, registrations with capacity, calendar | Done |
| School | Terms, classes, teachers, enrollment, sessions, attendance rates | Done |
| Attendance and check-in | Services with usher headcount, member and guest check-in, kids check-in with pickup codes, weekly trend | Done |
| Dashboard and reports | Section 6 | Done |
| Public landing site | Live campuses, service times, ministries, and room rates from `GET /public/landing` (done); visitor form, prayer requests, spam protection (Phase 8) | Partly done |
| Mobile app | React Native (Expo) | Phase 9 |

## 6. Phase 7: Dashboard and Reports

### 6.1 User stories

- As a pastor, I see attendance per service over a date range so I can spot drops early.
- As a branch admin, I see how many people joined and became members each month.
- As a ministry coordinator, I see how many people serve in each ministry and how many joined or left.
- As an events lead, I compare registrations with actual check-ins for each event.
- As a facilities lead, I see how much each room is booked and what that time is worth at its hourly rate.
- As any report reader, I download the report as CSV for a spreadsheet, or save it as PDF to share.
- As a staff member opening the dashboard, I see which rooms are in use today.

### 6.2 Functional requirements

| ID | Requirement |
|---|---|
| R1 | Every report takes a date range (`from`, `to`, church local dates) and an optional branch. Default range: the last 12 weeks ending today. Maximum range: 366 days. `from` must not be after `to`. |
| R2 | Branch users always get their own branch, whatever branch they ask for. Church-wide users get all branches or the one they pick. |
| R3 | Attendance report: one row per service (date, branch, service, headcount, check-ins, children, reported attendance). Summary: services, total, average, peak, check-ins, children. Reported attendance follows the Phase 6 rule (headcount, never below check-ins). |
| R4 | Membership growth report: one row per calendar month in the range (new people added, new members by membership date, baptisms). Summary: totals for the range plus current people by status. |
| R5 | Ministry participation report: one row per ministry (category, branch, active people at the end of the range, leaders, joined in range, left in range). Summary: ministries, unique people serving, share of active people who serve. |
| R6 | Event turnout report: one row per event starting in the range (date, title, category, status, capacity, registered, checked in, turnout percent, fill percent). Summary: events, registrations, check-ins, average turnout. |
| R7 | Room utilization report: one row per active room (branch, capacity, approved bookings, booked hours, utilization percent of open hours, hourly rate, estimated value). Open hours: 14 per day (7:00 to 21:00). Booked time is clipped to the range. Summary: rooms, booked hours, average utilization, estimated value. |
| R8 | CSV export of any report with the same filters, one header row, then data rows. Cells that start with `=`, `+`, `-`, `@`, tab, or carriage return are prefixed with `'` so spreadsheets never run them as formulas. |
| R9 | PDF export through the browser print dialog with a print layout (no sidebar, paper colors, range and branch in the title). |
| R10 | Each CSV export is written to the audit log (action `reports.export`, report kind and filters, no row data). |
| R11 | Dashboard shows room usage today: approved bookings for today by room, with a marker on rooms in use right now. Needs `rooms.read`. |
| R12 | Reports module appears in the sidebar for users with `reports.read`, with one tab per report. |

### 6.3 Acceptance criteria

- Each report renders with seeded data, and its totals match the rows.
- A branch staff user asking for another branch gets their own branch data.
- `to` before `from`, a range over 366 days, or an unknown report kind returns HTTP 400.
- A user without `reports.read` gets HTTP 403.
- A CSV opens in a spreadsheet with correct headers, and a member name starting with `=` shows as text.
- Print preview shows only the report, on one paper-colored page per screen of rows.
- All of this works at 375 pixels wide without page-level horizontal scroll.

## 7. Non-functional Requirements

- Security: least privilege, branch isolation, audit every change, never log personal fields or secrets unredacted, pickup codes never listed.
- Privacy: reports show aggregates and gathering names, not personal contact data.
- Performance: each report returns in under 1 second for 2 years of data at one branch (indexed date filters, grouped counts, no per-row queries).
- Accessibility: WCAG 2.2 AA, keyboard reachable, reduced motion honored, numbers readable without color.
- Quality: strict Red-Green-Refactor TDD; Zod validation at every boundary.

## 8. Success Metrics

- Leaders stop keeping parallel attendance spreadsheets within one month of launch.
- Monthly reports for the board take under 5 minutes to produce.
- Zero incidents of a child released without a valid code or an audited override.

## 9. Open Questions

- Should room utilization use per-branch open hours from settings instead of the fixed 14 hours?
- Should reports be schedulable by email (needs email delivery, later phase)?
