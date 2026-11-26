# Church Management System

pnpm monorepo. See [docs/ROADMAP.md](docs/ROADMAP.md) for modules and phases.

| Package | Stack |
|---|---|
| `packages/shared` | Zod schemas, roles, and permissions shared by api and web |
| `packages/database` | Prisma schema, migrations, generated client, and all seeders |
| `api` | NestJS, PostgreSQL through `@cms/database`, JWT session cookie, Vitest |
| `web` | Next.js 16, Tailwind CSS 4, shadcn/ui (Base UI), TanStack Query, zustand, motion, Rune Icons, Vitest |

## Setup

1. `pnpm install`
2. Copy `api/.env.example` to `api/.env` and fill in the database URL (URL-encode special characters in the password), a JWT secret of 32 or more characters, and the seed accounts.
3. Build the shared package and api: `pnpm build`
4. Apply migrations: `pnpm --filter @cms/api db:deploy` (or `db:migrate` while developing)
5. Seed everything: `pnpm --filter @cms/api db:seed`

Sample users are created only when `SEED_SAMPLE_PASSWORD` is set. They all share that password and use the `@cms.local` domain. The seeder is idempotent.

## Run

- API (port 4000): `pnpm dev:api`
- API reference (Scalar): http://localhost:4000/docs. The OpenAPI document at `/openapi.json` is generated from the controllers and shared Zod schemas on every boot, so it always matches the code. Sign in with `POST /auth/login` on that page and the session cookie is used for the other requests. Docs are on by default outside production; set `API_DOCS_ENABLED` to override.
- Web: `pnpm dev:web` (this setup runs it on port 3002, because port 3000 belongs to another local project). The web app proxies `/api/*` to `API_URL` (default `http://localhost:4000`).

- Mobile app (Expo SDK 58): `pnpm --filter @cms/mobile start`, then open it in Expo Go or a development build. In development the app reaches the API on the same computer that serves it (the address Expo shows, port 4000), so a phone on the same Wi-Fi works with no setup; keep the API running and allow Node.js through the firewall. `mobile/.env` sets `EXPO_PUBLIC_API_URL` (see `mobile/.env.example`); leave it empty to let the app find the API on its own, and restart Expo after changing it. For a browser preview, `pnpm --filter @cms/mobile web` and start the API with `EXTRA_CORS_ORIGINS=http://localhost:8081`.

## Mobile app

`mobile/` is an Expo Router app for members and staff, in the admin's e-ink paper style (IBM Plex, ink glyphs, red only for failures).

- Sign in: `POST /auth/token` returns a bearer token, stored in the device keystore (`expo-secure-store`).
- Roles: three. ADMIN has every permission at every branch. PASTOR sees and manages everything at every branch except users, roles, settings, branch setup, and the audit log, which are ADMIN only. STAFF serve through ministries (Multimedia, Worship, Dance, Usher); each ministry membership has a position (ministry role), empty until the church office sets one.
- Home: next service with check-in state, the latest Sunday message and the three before it, upcoming events. Tapping a video opens the in-app player.
- Watch (`/watch/[id]`): the official YouTube embedded player, so plays count as views on the channel, with full screen, an "Open in YouTube" link, and an Up next list.
- Services: the next two weeks at every branch, the member's branch first. Tap a service for its detail screen (`GET /me/services/{id}`): date and time, branch with Directions and Call links, notes from the office, the check-in window, and whether you are checked in. Ushers get "Scan member cards for this service", which opens usher mode on that service; staff who take attendance also see the count so far.
- Scan tab: staff in the Usher ministry get the camera to scan members' QR cards for a service (`POST /services/{id}/check-ins/scan`, normal check-in rules). Everyone else sees their own QR card (`GET /me/qr`, valid 180 days; signing out everywhere or relinking the account makes old cards stop working).
- Events tab: ADMIN and PASTOR see every upcoming event at every branch; STAFF see the events of the ministries they serve in, at any branch (`GET /me/events`). Registration uses the normal capacity rules.
- Event detail (tap an event on the Events tab or Home, `GET /me/events/{id}`): category and ministry, date and time range, room and branch with Directions and Call, description, places left, a cancelled notice with the reason, your registration and check-in, and Register. It follows the Events tab rule, so staff get a 404 for events outside their ministries.
- Me: profile photo for every account (`PUT`/`GET`/`DELETE /me/photo`, JPEG or PNG checked by file signature, resized to 512 px on the phone), name, role and branch (`GET /me/account`), ministries with their position, membership, profile, household, and attendance history. Members edit their own contact and personal details (`PATCH /me/member`: email, phone, address, occupation, birthday, gender, civil status); names, status, branch, and household stay with the church office. Sign out is the icon at the top right and asks first. Ushers also get "Events at my branch" and "Usher mode" buttons. Below Attendance, a Tools section lists tools from `mobile/src/lib/tools.ts` (icon, label, description); each opens `/tools/[id]`. The three current tools are placeholders.
- Music Library (Me tab, Tools): for ADMIN and STAFF serving in the Worship ministry (others get a 403 and a note).
  - Search: Apple iTunes Search and MusicBrainz at once (`GET /music/search`), by anything, title, or artist, with a genre filter. Results show source, links, artwork, and the iTunes 30-second preview. Neither catalog gives musical key or BPM, so the original key is set when a song is added to the library; nothing is guessed. If one catalog is down the other's results still show. Set `MUSICBRAINZ_CONTACT` in `api/.env` so MusicBrainz does not throttle the API.
  - Our library (`GET/POST /music/songs`, `PATCH /music/songs/{id}`): songs the team added, searchable by title, artist, composer, genre, language, and original key. A catalog song is stored once per source and ID.
  - Playlists (`/music/playlists`): create, rename, duplicate, delete (soft), add from search without leaving the page (`POST /music/playlists/{id}/songs`, refuses a song already in the list), and save the arranged list (`PUT /music/playlists/{id}/songs`: order, a key per song, notes; replaced in one transaction).
  - Keys: all 12 keys plus Db, Eb, Gb, Ab, Bb. Each playlist song has its own selected key, the transposition is the shorter way round (for example D to E is +2 semitones, G to E is -3), and Reset returns to the original. The math lives in `@cms/shared` (`transposeSemitones`).
  - Arranging: long-press a song's number to drag it; Duplicate puts a second copy below (a reprise). Unsaved work stays in memory per playlist while moving between screens. Screen readers get Move up and Move down actions. Phones switch between Search and Playlist; tablets show both side by side.
  - Song sheet: tap a song card in the playlist to open its chords and lyrics, with every chord moved to the key chosen for that playlist (the chord spelling follows the key, so flat keys get flats). Change the key there too, reset to the original, or make the text larger. Charts are typed or pasted once per song from the church's licensed copy (for example CCLI SongSelect) in ChordPro style: `You were the [D]Word at the be[A]ginning`, with `[Chorus]` lines as headings (`GET`/`PATCH /music/songs/{id}`, `chart`, up to 20,000 characters). Lyrics are never fetched from the internet, and the audit log records only that a chart changed and its length. The parsing and transposition live in `@cms/shared` (`parseChart`, `transposeChart`).
  - Viewer (like lyrictool): a semitone transpose bar (Song key, New key, the change, Revert to original, Save key to playlist), Chords and lyrics, Lyrics only, or Chords only, Paper, Sepia, and Dark themes, a text-size slider (12 to 34), Share as ChordPro, previous and next through the setlist, and auto-scroll that follows the song's BPM and text size (slower and faster buttons, pauses when you touch the sheet, keeps the screen on). Choices carry over to the next song while the app is open.
  - Stage mode: one section at a time in large type, tap the right or left edge or swipe to move, the next section previewed underneath, then on to the next song in the setlist. Tools add theme, display mode, key up or down, and a metronome (40 to 240 BPM, tap tempo, visual beat). The screen stays on.
  - All songs (`/music/songs`): the whole library, searchable, sorted by title, artist, key, or most recent, filtered by key and by whether a song has chords yet (`GET /music/songs?sort=&hasChart=`). Add song creates a song by hand with title, artist, composer, tempo, genre, language, key, and chart.
  - Editor: a chord bar with the key's six common chords and section headings, inserted at the cursor; one-tap conversion of text with chords on their own lines above the lyrics; Edit and Preview; Share as ChordPro.
- Accounts: member features and ministries need the account linked to a member record (Users page, "Link member"). Sample staff accounts are linked to sample members: `staff.grace` (Multimedia), `staff.elena` (Worship), `staff.david` (Dance), `usher.roberto` and `member.ngozi` (Usher), all `@cms.local`.
- QR codes: `cmsqr1.<payload>.<signature>`, HMAC-SHA256 with a key derived from `JWT_SECRET` (never usable as a session). Service posters: on each service page, "Check-in QR", valid until six hours after the start.
- Tests: `pnpm --filter @cms/mobile test` (API client, QR routing, church-time formatting, profile form, roles, photo and YouTube helpers, tools, playlist drafts) and `pnpm --filter @cms/mobile typecheck`.

## Checks

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`

## Conventions

- Web tests live in `web/test`, mirroring `web/src` (for example `web/test/features/landing/drift-wall.test.tsx` tests `web/src/features/landing/drift-wall.tsx`) and importing through `@/`.

- Every new endpoint gets `@ZodBody` / `@ZodQuery` (from `api/src/docs/zod-openapi.ts`) with the same shared schema its validation pipe uses, and its controller gets `@ApiProtected("Tag")`. `api/src/docs/api-docs.test.ts` checks that routes appear in the docs.
- Admin pages: `page.tsx` is a server wrapper exporting `instant = false`; the screen lives in `view.tsx` (`"use client"`).
- Animations use the primitives in `web/src/components/motion` (`FadeIn`, `Stagger`, `MotionTableBody`, `AnimatedNumber`). `MotionConfig reducedMotion="user"` respects the OS setting.
- Public landing page motion (`web/src/features/landing`): section entrances use `Reveal`, `RevealList`, and `RevealItem` from `reveal.tsx` (once, on scroll into view); the pickup diagram is the one signature move; the photo gallery is `GalleryCarousel`, a slow endless row with a Pause button that stops on hover, focus, or off screen and becomes a still grid under reduced motion.
- Icons come from Rune Icons (`runeicons-react`, pinned) through `web/src/components/icons.tsx`, which adds `className` and `aria-label` support. Import from `@/components/icons` only. When `npx shadcn add` generates a component, replace its `lucide-react` imports with the matching icon from that module (add a new wrapper there if needed).
- Admin look: "e-ink paper". Warm paper grounds, near-black ink, 1px hairlines, no shadows, light theme only (tokens in `web/src/app/globals.css`). Fonts: IBM Plex Sans (`font-sans`, `font-heading`) and IBM Plex Mono; put `font-data` (mono with aligned figures) on every number, id, date, and code, and `micro-label` on section and table labels.
- No hue classes in admin code (`src/lib/ink-palette.test.ts` fails on them). Show state with `StatusGlyph` (`components/status-glyph.tsx`: done = filled dot, active = half ring, waiting = empty ring, off = dashed ring, failed = red). Red (`destructive`) is only for failures, errors, and destructive actions.
- Every admin page plays a top-to-bottom entrance from `.ink-page` in `(admin)/template.tsx`; the sidebar's active rule glides between items. Sidebar groups, the breadcrumb, and the Ctrl+K module search all read from `components/admin/nav-items.ts`.

## Database

Everything about the database lives in `packages/database`:

```
packages/database/
  prisma/schema.prisma      tables, enums, relations
  prisma/migrations/        every migration, including hand-written SQL constraints
  prisma.config.ts          reads DATABASE_URL from packages/database/.env, then api/.env
  src/index.ts              exports PrismaClient, Prisma types, enums, createPrismaClient
  seed/index.ts             seed runner (all modules, in dependency order)
  seed/seeders/*.ts         one seeder per area: core, members, ministries, rooms-events, school, attendance
  seed/data/*.ts            sample data per area (pure data, unit tested in seed/data.test.ts)
```

Run these from the backend, or from the repository root (`pnpm db:migrate`, `pnpm db:seed`, `pnpm db:generate`, and so forth), which forwards to the backend. After `db:migrate`, run `db:generate` so the client knows the new tables.

| Command | What it does |
|---|---|
| `pnpm --filter @cms/api db:migrate` | Create and apply a migration after editing `schema.prisma` (development) |
| `pnpm --filter @cms/api db:migrate:create` | Create a migration without applying it, for hand-written SQL |
| `pnpm --filter @cms/api db:deploy` | Apply pending migrations (servers, CI) |
| `pnpm --filter @cms/api db:status` | Show which migrations are applied |
| `pnpm --filter @cms/api db:seed` | Seed all modules. Safe to rerun: it only adds what is missing |
| `pnpm --filter @cms/api db:reset` | Drop the database, reapply every migration, and seed. Deletes all data |
| `pnpm --filter @cms/api db:generate` | Regenerate the Prisma client |
| `pnpm --filter @cms/api db:studio` | Open Prisma Studio |

Seed accounts come from `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, and `SEED_SAMPLE_PASSWORD` in `api/.env`. Event, school, and attendance dates are relative to the next Sunday (Asia/Manila), so they are seeded once per database.

## Attendance and check-in

- Services (`/attendance`): worship gatherings with an optional usher headcount. Reported attendance is the headcount, but never fewer than the people checked in.
- Check-in works the same for a service (`/attendance/services/:id`) and an event (Check-in section on the event page). Event check-ins are marked Registered or Walk-in.
- Kids check-in records a guardian (a member, or a name and phone) and issues a 5-character pickup code from an alphabet without look-alike characters. The code is shown once, with a printable child tag and guardian stub. It is never returned by list endpoints and never written to the audit log.
- Checkout needs the code and a person allowed to collect: the guardian recorded at check-in or a household head or spouse. Five wrong codes lock the check-in. People with `attendance.override` (Super Admin, Branch Admin, Pastor) can release a child without the code by giving a reason, which is audited.

## Calendar image

- `/events/design` (button "Design calendar image" on the Events page): a shareable month calendar drawn on a canvas, so the preview is exactly the PNG you download.
- Styles: Colorful (default), Paper ink, Bold, Minimal. Palettes: Sunrise, Lagoon, Berry, Forest. Every color (background, header, accent, text) and both fonts (heading and body, from Fraunces, Playfair Display, Space Grotesk, Host Grotesk, Nunito, IBM Plex Sans, IBM Plex Mono) are editable.
- Layouts: month grid, list, or one week. Toggles for times, rooms, and footer.
- Sizes, grouped in the picker: Social (square 1080 x 1080, portrait 1080 x 1350, story 1080 x 1920, Facebook 1200 x 630, X 1600 x 900), Screens (landscape 16:9 1920 x 1080, projector 4:3 1440 x 1080), Print at 150 dots per inch (A4 portrait and landscape, US Letter, bulletin insert 5.5 x 8.5 in). The drawing scales by the shorter side, so wide images keep a short header.
- Click a day on the image to jump to its events; each event can be renamed or hidden for the image only (the event itself does not change).
- Colorful chips use one color per event category, each passing 4.5:1 contrast with white text. Code: `web/src/features/events/calendar-image` (`model.ts` and `design.ts` are pure and tested; `draw.ts` renders).

## Reports

- `/reports` (permission `reports.read`): attendance, membership growth, ministry participation, event turnout, and room utilization for any date range (default: the last 12 weeks; at most 366 days) and, for church-wide users, any branch. Branch users always see their own branch.
- Filters live in the URL, so a report link can be shared.
- CSV: `GET /reports/{kind}/csv` with a UTF-8 byte order mark; text cells starting with `=`, `+`, `-`, `@`, tab, or carriage return get a leading `'` so spreadsheets never run them as formulas. Each export is audited as `reports.export` (filters and row count, no row data).
- PDF: the PDF button opens the browser print dialog with a print layout (no sidebar or header); choose "Save as PDF".
- Room utilization measures approved booking hours against 14 open hours a day (7:00 to 21:00) and values them at each room's hourly rate.
- The dashboard shows "Rooms today": approved bookings by room, rooms in use right now first.

## Landing page

The public page at `/` lives in `web/src/features/landing`:

- `content.ts`: every string, link, and sample value, typed. It is the fallback copy.
- Live data: `web/src/app/page.tsx` reads `GET /public/landing` (no sign-in, rate limited, cached 5 minutes, no personal data), validates it with `publicLandingSchema`, and `live.ts` (`mergeLanding`) lays church name and contacts, campuses with this week's service times, active ministries, and room rates over the copy. If the API is down or slow, the page shows the written copy.
- First-visit section: the five steps sit beside `drift-wall.tsx`, a tilted wall of photo placeholders whose columns drift up and down (adapted from React Bits DriftWall). Each photo is announced once, tiles stay out of the tab order, a small icon button pauses it, it rests off screen, and it stands still under reduced motion.
- Names of Jesus: `names-marquee.tsx`, a full-width black band of six rows above the ministries that drift in alternating directions and speed up while the page scrolls. Screen readers get one plain list; hover or the icon button pauses it; it stands still under reduced motion. The names live in `content.ts` (`namesOfJesus`).
- Team: `profile-card.tsx` (adapted from React Bits ProfileCard) shows each person as a framed portrait card that tilts toward the pointer with a holographic foil; a labelled initials placeholder stands in until portraits are added (`photo` in `content.ts`), the footer shows the campus, and Contact emails the church office with the person's name in the subject. Tilt and foil stay off under reduced motion.
- Videos (replaced the questions section): `videos-section.tsx` features the newest video on the church's YouTube channel with the next three beside it. The API reads the channel ID from the church-wide setting `youtube.channel_id` (seeded as Grace Testament Church, `@gtcphofficial`), fetches the channel's public feed (no API key), caches it 30 minutes, and keeps the last good list if YouTube fails (`GET /public/videos`). On networks that reach the internet only through a proxy, set `HTTPS_PROXY` (and `NO_PROXY` for local hosts) in the API's environment; the feed request uses it (undici `EnvHttpProxyAgent`). When the feed cannot be reached the API logs "YouTube feed unavailable" with the reason. No YouTube player loads until a visitor presses play, and the player uses youtube-nocookie.com. Without videos the section shows labelled placeholders. The heading always links to the channel (Grace Testament Church on YouTube, `@gtcphofficial`), and so does "See all on YouTube"; both are set in `content.ts` (`videos.channel`).
- Hero title: `cipher-reveal.tsx` decodes the title out of scrambled characters once (about 1.3 seconds), keeps each letter's width so lines never reflow, gives screen readers the real text, and shows it at once under reduced motion.
- `landing-page.tsx` and `mobile-menu.tsx`: the sections in order (announcement, header, hero, ministries, church life, first visit, team, room hire, questions, closing, footer).
- `landing.css` with the typed class map in `styles.ts`: a global stylesheet with `lp-` prefixed classes. CSS modules do not work here, because `next.config.ts` runs every `.css` file through the Tailwind loader as plain CSS.
- Look: stone grounds `#eceae5` and `#e3e1dd`, black ink, blue `#1d4ed8` only on the logo mark and the pickup tag diagram, sharp corners. Host Grotesk for headings and IBM Plex Mono for text; both load only on this page.
- Photos: none are supplied yet. The hero and gallery show labelled placeholders that describe the shot each one needs.
