# ExamPro

Static exam-practice website (HTML/CSS/JS) **plus an optional Node server** that adds a student portal, an admin dashboard and a SQLite database.

## Put it on GitHub / go live
1. Create a GitHub repo and upload everything in this folder (`data/` and `.env` are git-ignored on purpose).
2. **Full site (portal + admin + database):** connect the repo to a Node host. Render: New > Blueprint > pick the repo (`render.yaml` is included), then set `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Docker hosts can use the `Dockerfile`.
3. **Website only:** GitHub Pages works for the public site, but the student portal, admin dashboard and database need the Node server.

## Two ways to run

| Mode | Command | What works |
|---|---|---|
| Static (Live Server, any static host) | open `index.html` | Whole practice site, PWA, content editor (`admin.html`). Student/Admin login show "server not running". |
| Full (Node server) | `npm start` | Everything above **plus** student portal, admin dashboard, DB-backed metrics, notifications, exam scheduling. |

Requires **Node.js 22.13+** (uses built-in `node:sqlite`; **no npm install needed**, zero dependencies).

## Quick start
Windows: **double-click `start.bat`** (Mac/Linux: `./start.sh`). It creates demo data on first run, starts the server and opens http://localhost:3000.
Use **http://localhost:3000**, not Live Server (port 5500): login needs the server.
```
npm run seed        # dev admin + 3 demo students (development only)
npm start           # http://localhost:3000
npm test            # 17 automated API/security tests
```
Copy `.env.example` to `.env` to change port, secrets, timeouts.

## Demo credentials (development only, fictional data)
| Who | Login | Password |
|---|---|---|
| Rahul Kumar (CCNA Basics) | `DEMO001` or demo001@example.com | `Demo@12345` |
| Priya Singh (Computer Fundamentals) | `DEMO002` | `Demo@12345` |
| Amit Sharma (Networking Essentials) | `DEMO003` | `Demo@12345` |
| Admin (dev only) | `admin@exampro.local` | `Admin@12345` |

Reset demo data: `npm run reset-demo`. Remove it: `npm run purge-demo`. In production (`NODE_ENV=production`) the seed refuses demo data and only creates an admin from `ADMIN_EMAIL` + `ADMIN_PASSWORD`. **Never deploy with the dev admin password.**

## Routes
| Route | Purpose |
|---|---|
| `/` | Public website only (tests, pricing, test types...). Header **Login** = student portal login when the server runs. Small **Admin Login** link in the footer opens a popup |
| `/student/login` | Student login (dashboard opens in a new tab; fallback button if blocked) |
| `/student/dashboard` `/profile` `/exams` `/notifications` `/settings` | Student portal (own layout) |
| `/exam/:examId` | Eligibility check, then opens the independent exam page `test-attempt.html` |
| `/admin/login` | Admin login page (same login as footer popup) |
| `/admin/dashboard` `/students` `/courses` `/exams` `/notifications` `/analytics` `/audit` `/settings` | Admin dashboard (sidebar) |
| `/admin.html` | Separate **site content editor** (promos, announcement bar, extra questions/tests → `content.json`); unchanged, local |

## Project structure
```
index.html, exams.html, tests.html, ... shared.css, shared.js   static site (unchanged paths)
sw.js, manifest.json, offline.html, icons/                      PWA
content.json                                                    published site content
portal/   student-login, student, admin-login, admin-app (+ portal.css/js, student.js, admin.js)
server/   index.js app.js core.js db.js lib.js seed.js config.js routes/{public,student,admin}.js
test/     api.test.js
data/     SQLite DB + generated secret (git-ignored)
```

## How the numbers are counted
* **Registered students** – rows in `students`. **Enrolled** – distinct students with an `active` enrollment.
* **Total visitors** – unique browsers. A random first-party cookie (`ep_vid`) is stored; only an HMAC of it is saved (no IP, no user-agent). One visit row per browser per day, so reloads and repeat visits don't inflate counts.
* **Active users** – visitors with a heartbeat (every 60 s while the tab is visible) within the timeout; **active students** – signed-in student sessions seen within the timeout. Timeout: `ACTIVE_TIMEOUT_MIN` or Admin → Settings (default 5 min).
* **Exams** – completed = published and window ended; upcoming = published and not started; open = in window.
* Everything is zero/empty until real data exists. Demo accounts add sample rows (the dashboard says so).

## Security summary
scrypt password hashing · server-side sessions (random token, only its hash stored; HttpOnly + SameSite=Strict cookies, `Secure` over https) · **separate cookies/sessions for students and admins** · role checks on every API · student data always scoped by the session user, never by a browser-supplied ID · CSRF token + same-origin check on every state-changing request · parameterised SQL only · login rate limits and lockout · security headers + CSP · output escaping in all UIs · CSV-injection-safe export · audit log of admin actions · static file server blocks `server/`, `data/`, `.env`, `package.json`.

## Known limitations (honest)
* **Exam questions live in the static site**, so the server cannot re-grade. The exam page reports the score; the server enforces who may submit, the exam window and the attempt limit. A technically skilled student could submit a false score. Real anti-cheat needs questions served from the DB (future work).
* Rate limits and visitor "active" tracking are per server process (in memory / single DB). Use one instance, or move to a shared store.
* Visitors are counted only when the Node server serves the site (not on Live Server).
* Students are created by admins (no self-registration into the DB yet). The older `login.html`/`register.html` remain local demo pages.
* CSP allows inline scripts because the original pages use them.
* Deploy behind https (set `COOKIE_SECURE=1` / `NODE_ENV=production`, set `SESSION_SECRET`).

## Deploy
Any Node 22.13+ host: set env vars from `.env.example`, `NODE_ENV=production`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, run `npm run seed` once, then `npm start`. Persist the `data/` folder (backup `exampro.db`).

## Cleanup report
Nothing was deleted: `test.html` and `info.html` are small redirect shims for old links (not referenced by the site but kept for backward compatibility); the old admin editor `admin.html` is a different feature from the new admin dashboard and is linked from it.
