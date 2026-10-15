# SOP: NILORA project handbook

Mirror of the SOP tab of the NILORA Claude Doc (kept in sync every turn, rule 13). This handbook lets a new person or a new AI continue the project from the very start to now without asking questions. The Conversation log (`docs/CONVERSATION_LOG.md`) records what happened; this SOP explains how and why, and what to do next.

## 1. What NILORA is
A music streaming app. It started as one HTML file (`legacy/NILORA.html`) that kept everything in the browser. It is becoming a real service: a database, private API endpoints, private song storage, containers, Kubernetes and git, at a cost of 0 rupees, shareable with friends by link. Anyone can open the app and listen without logging in; login is asked only for Download or when the person chooses to sign in.

## 2. How to work on this project (every turn, human or AI)
1. Read `docs/RULES.md` and the three newest entries of `docs/CONVERSATION_LOG.md`.
2. Read section 4 (current state) and section 9 (open items) of this SOP.
3. Plan first. Write code only after the user agrees to the plan or phase.
4. Do the work. Never put secrets (passwords, keys, tokens, `.env` values) in docs or committed files.
5. Add a Conversation log entry (newest on top): date, the user's request, your proposal or plan, the outcome. Do it in the Claude Doc and in `docs/CONVERSATION_LOG.md`.
6. Update every SOP section the turn touched, and add a line to section 11. Update `VERSION`.
7. Build the zip (section 6) and reply with the zip and the link to the Claude Doc, saying what was and was not tested.

## 3. Timeline from the start
Times are not recorded; all entries are dated 2026-10-10 and ordered by number.

| # | What the user wanted | What was done | State after |
| --- | --- | --- | --- |
| 1 | Database SQL for emails, passwords, admin-uploaded music; backend setup steps | Read NILORA.html; built MySQL schema, Node/Express backend, bridge file, README, zip | Delivered, syntax-checked only (now `legacy/nilora-backend-v0/`) |
| 2 | Docker, Kubernetes, private endpoints with temporary keys, scalable, recoverable, git, 0 rupees; plan first | Full plan: architecture, signed tickets, free stack, git layout, 7 phases | Plan only |
| 3 | Hosting: PC daily, free cloud VM for heavy tests and later hosting | Locked the hybrid; assumed 10 to 50 friends, 5 to 20 GB | Phase 1 proposed |
| 4 | Make a Claude Doc from the last answer | Created the doc | Done |
| 5 | Log every turn in the doc, rule in the doc, link every turn | Standing rules, Conversation log, Master plan | Done |
| 6 | Guest-first login, a detailed SOP, focus on API, song storage, playback | Rule 11, SOP, Next objective (API v1, storage, play flow) | Plan written |
| 7 | Guests hear full songs; first client = most devices | Checked Flutter's platform list; chose Flutter first | Decided |
| 8 | Confirmed Flutter; wants the Compose file or zip every turn; SOP and doc updates inside the project | Built the project: Compose stack, api, stream, web, tests, docs; rules 12 and 13 | Delivered; Docker run not yet verified |
| 9 | Check all files and explain project identity & state | Full audit of files & architecture; 6/6 unit tests verified; Node v25 confirmed; Docker status noted | Overview provided; entry #9 zip created |
| 10 | User asked "next"; proposed paths (Flutter app / standalone runner / web player & auth) | Formulated 3 execution paths; awaiting user agreement per Rule 4 | Plan proposed; entry #10 zip created |
| 11 | Scaffolded Flutter multi-platform client | Built `clients/flutter`: config, models, services (API v1, just_audio player, storage), providers, UI (HomeScreen, NowPlaying, MiniPlayer, AuthDialog) | Flutter client ready; entry #11 zip created |
| 12 | Step-by-step setup guide for running NILORA on PC | Explained exact prerequisites (Docker Desktop) and 3 startup commands; entry #12 zip | Delivered guide and zip |
| 13 | Fix MinIO Docker image pull error | Switched from deprecated `minio/minio:latest` to `alpine/minio:latest-release` in Compose with HTTP liveness check | Fixed Compose stack; entry #13 zip created |
| 14 | Run stack, create admin, verify smoke test | Resolved container permissions (`user: 0:0`), started all 6 services healthy, created admin, ran smoke test (22/22 checks passed) | Full stack running & verified; entry #14 zip created |

## 4. Current state (after entry #14)

**What exists in this project**
- `clients/flutter`: complete cross-platform Flutter client app (models, API v1 client, audio player with play ticket & Range streaming, guest home, now playing, auth modal).
- `docker-compose.yml`: MySQL 8.4, Redis 7, MinIO (`alpine/minio:latest-release`), `api`, `stream`, `web`.
- `services/api`: Express API v1 (see `docs/API.md`): guest session, home/songs/search/library, play and download tickets, likes, signup/verify/login/refresh/logout, admin login and song upload to MinIO.
- `services/stream`: checks signed tickets and serves audio and covers from private MinIO with Range support. Never talks to MySQL.
- `services/web`: guest-first web client (`index.html`) and admin page (`admin.html`); nginx writes `config.js` from `PUBLIC_API_URL` at start.
- `db/migrations/001_init.sql`: schema (keys not URLs).
- `scripts/`: `init-env.js` (creates `.env` with random secrets), `smoke-test.js` (end-to-end check).
- `tests/unit.test.js`: 6 unit tests.
- `docs/`: rules, SOP, conversation log, API.
- `legacy/`: the original HTML and the first backend.

**Tested so far:** All 6 Docker containers running and healthy. Admin account created (`admin@example.com`). All 22 checks in `smoke-test.js` passed end-to-end (upload, guest playback, range requests, signed tickets, token rotation, tamper checks). All 6 unit tests pass. Flutter app scaffolded (not yet compiled).

**Decided**
- Hybrid hosting; Node.js; MySQL; Redis; MinIO; services `web`, `api`, `stream`; signed tickets; GitHub Actions and Argo CD; guest-first access; one `/v1` API; guests hear full songs; Flutter is the first client (TV and watch later as thin clients).

**Not built yet**
- The Flutter app, forgot-password, play history and likes in the web client, Kubernetes manifests, CI/CD, tunnel, backups, monitoring, audio transcoding.

## 5. Architecture in one paragraph
The browser or app talks to an edge (tunnel and ingress; locally, direct ports). Behind it are `web` (static page), `api` (auth, catalog, admin) and `stream` (audio). `api` uses MySQL and Redis and writes uploads to a private MinIO bucket; `stream` reads audio from MinIO. Every API call carries a token (guest, user or admin). Audio is reached only with a short signed play ticket from `api`. Ticket = `HMAC-SHA256(TICKET_SECRET, kind.id.sub.exp)`. Details: `docs/API.md`.

## 6. How to run things

**Start the stack (needs Docker Desktop and Node.js on your PC)**
1. Unzip the project and open a terminal in the `nilora` folder.
2. `node scripts/init-env.js` creates `.env` with random secrets (or copy `.env.example` to `.env` and edit it).
3. `docker compose up --build` (first build takes a few minutes).
4. Create the admin login: `docker compose exec api node src/scripts/create-admin.js admin@example.com StrongPass123`
5. Open http://localhost:3000/admin.html, log in, upload a song (audio file; cover optional).
6. Open http://localhost:3000 as a guest: no login, the song appears on the home page, press the cover to play. Press Download: the login prompt appears.
7. Check everything: `node scripts/smoke-test.js` (needs `DEV_EXPOSE_OTP=true`, the default in `.env.example`).

**Useful commands**
- Logs: `docker compose logs -f api` (also shows email codes when SMTP is not set).
- Stop: `docker compose down`. Reset all data: `docker compose down -v`.
- MinIO console (this PC only): http://localhost:9001, login with `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD` from `.env`.
- Unit tests: `node --test tests/unit.test.js`

**Git (first time)**: `git init`, `git add .`, `git commit -m "NILORA entry 8"`. `.gitignore` already blocks `.env`, `node_modules` and zips. Push to a free private GitHub repo.

**Build the delivery zip (AI procedure, rule 12):** from the folder that contains `nilora/`: `zip -r nilora-project-entry-NN.zip nilora -x "*/node_modules/*" "*/.env"`, then present it with the doc link.

## 7. Conventions
- **API:** everything under `/v1`; `docs/API.md` is the contract (an OpenAPI file comes later).
- **Storage:** the database keeps object keys, never URLs; the stream service derives keys from the song id.
- **Secrets:** only in `.env` (local) or Kubernetes Secrets; never in git, docs or the Claude Doc.
- **Git:** `main` is production; short-lived branches merge by pull request; images tagged with versions such as `v0.1.0`.
- **Cost:** 0 rupees only; flag anything that could cost money before proposing it.
- **Dates and numbers:** dates are ISO (2026-10-10); log entries are numbered.
- **ticket.js** is duplicated in `services/api/src/lib/` and `services/stream/src/`; a unit test fails if the two differ.

## 8. Security and legal checklist
- [ ] Rotate the EmailJS keys that were public in the original HTML (the new stack does not use them).
- [x] Admin login uses the `admins` table with a hashed password (the old default `nilora@admin` is gone from the new stack).
- [x] Guest tokens: rate limited per IP; cannot download or reach admin (checked in the smoke test).
- [ ] Set `DEV_EXPOSE_OTP=false` before friends use it.
- [ ] Ticket-signing key and JWT secret: keep in secrets, decide how to rotate them.
- [ ] MinIO uses the root account in development; create a limited service account before going online.
- [ ] Use HTTPS (tunnel or ingress) before sharing publicly.
- [ ] A recording of playing audio cannot be prevented; tickets stop hotlinking and scraping only.
- [ ] Upload only music the owner has the rights to share.

## 9. Open items
- [x] Run the stack on the PC and the smoke test (all 6 containers healthy, 22/22 smoke checks passed).
- [ ] Confirm the assumptions of 10 to 50 friends at once and 5 to 20 GB of music.
- [x] Scaffold the Flutter app (`clients/flutter`: guest home, play via ticket, login prompt on Download).
- [ ] Test/run the Flutter app on device/emulator (needs Flutter SDK installed).
- [ ] Kubernetes manifests, CI/CD, tunnel, backups.
- [ ] Web client guest likes and history: localStorage sync.

## 10. Glossary
| Term | Meaning |
| --- | --- |
| Guest token | Short-lived token given to anyone who opens the app, no login needed |
| Access token | 15-minute token for a logged-in user |
| Refresh token | 30-day token that renews the access token; rotated on every use |
| Play ticket | Signed stream URL valid about 2 minutes, issued by `api` |
| Download ticket | Signed URL valid 60 seconds, usable at most 3 times, users only |
| Edge | The public entry point: tunnel plus ingress |
| Ingress | The Kubernetes component that routes web requests to services |
| k3s, k3d, kind | Light Kubernetes for a VM (k3s) or for practice on a PC (k3d, kind) |
| MinIO | Self-hosted storage that speaks the S3 protocol |
| GitOps | The cluster follows what is in git; Argo CD applies changes |
| Range request | Asking for part of a file, which makes seeking in a song work |

## 11. SOP change history (newest first)
| Date | Entry | Change |
| --- | --- | --- |
| 2026-10-12 | #14 | Started full stack (all 6 services healthy), created admin, smoke test 22/22 passed; entry #14 zip |
| 2026-10-12 | #13 | Fixed MinIO image in `docker-compose.yml` to `alpine/minio:latest-release` after Docker Hub deprecation; entry #13 zip |
| 2026-10-12 | #12 | Step-by-step setup guide for PC running; entry #12 zip |
| 2026-10-12 | #11 | Scaffolded Flutter multi-platform client (`clients/flutter`) with models, API v1 client, player, and guest UI; entry #11 zip |
| 2026-10-12 | #10 | Proposed roadmap options for next phase (Flutter app, standalone local runner, web player/auth); entry #10 zip |
| 2026-10-12 | #9 | Audited all files, verified unit tests (6/6 passing), checked local environment, added entry 9 zip |
| 2026-10-10 | #8 | Project folder built; SOP now lives in the project too; run steps, zip procedure, tested/untested status, timeline row 8 |
| 2026-10-10 | #7 | Decisions: guests hear full songs; Flutter first |
| 2026-10-10 | #6 | SOP created; covers entries #1 to #6 |
