# School Management System (SMS)

A full-stack K-12 school management platform built for Ghanaian second-cycle
schools.

**Stack**

- **Frontend** - Next.js 16 (React 19) + TypeScript, Tailwind v4, TanStack Query
- **Backend** - Node.js 20 + Express + TypeScript, Prisma ORM
- **Database** - PostgreSQL 16
- **Deploy** - Docker Compose (one command brings the whole stack up)

**Traffic flow**

```
Browser --> Next.js frontend (port 3000)
              Next.js rewrites paths beginning with /api/ to the backend
        --> Express API (port 5000)
        --> PostgreSQL 16 (private Docker network)
```

## Features (current)

- **Student registry** - enrollment, demographics, guardians, class placement,
  billing, departure/off-boarding with immutable audit log.
- **Teacher/faculty registry** - onboarding, demographics, compliance, payroll,
  departure with academic and treasury clearance.
- **Non-teaching staff registry** - HR, IT-asset, treasury clearance on exit.
- **Attendance** - section-wise capture with separate desktop and mobile layouts.
- **Gradebook** - entry with automatic weighted-GPA recomputation and FACULTY
  authorization (a teacher can only grade subject/class combinations they are
  assigned to in the timetable).
- **Timetable** - configuration of periods, breaks, and subject-teacher
  allocation per section.
- **Finance engine** - fee structures per section, invoice generation, payment
  collections (auto-applied to the oldest outstanding invoice), chart of
  accounts ledger, expenses, combined teacher plus staff payroll.
- **Auth** - short-lived JWT access tokens (15 min) plus DB-backed rotating
  refresh tokens (7 days) stored in httpOnly cookies; per-email lockout
  (5 failed attempts locks for 15 minutes); RBAC roles STUDENT, STAFF,
  FACULTY, ADMIN, ACCOUNTANT.
- **Hardening** - audit logging of all write operations with sensitive-field
  redaction; CSV export on every paginated list; recursive XSS sanitization;
  Helmet; global and auth-specific rate limiting.

## Repository layout

| Path | Purpose |
| --- | --- |
| `docker-compose.yml` | Postgres, backend, frontend on a private Docker network |
| `.env.example` | Compose-level secrets and environment configuration |
| `scripts/backup.sh` | pg_dump backup/restore helper against the Postgres container |
| `backups/` | Backup output directory (`.sql.gz` files are git-ignored) |
| `.github/workflows/` | GitHub Actions CI (lint, build, test, Docker build) |
| `sms-core/` | Next.js 16 frontend |
| `sms-core-backend/` | Express REST API, Prisma schema, and all migrations |

## Quick start (Docker - recommended)

Requires Docker Engine v24+ with the Compose plugin.

1. `cd ~/sms-monorepo`
2. `cp .env.example .env`
3. Generate strong secrets and paste each value into `.env`:

   ```bash
   openssl rand -hex 32   # POSTGRES_PASSWORD
   openssl rand -hex 32   # JWT_SECRET
   openssl rand -hex 32   # JWT_REFRESH_SECRET  (MUST differ from JWT_SECRET)
   openssl rand -hex 32   # COOKIE_SECRET
   ```

   For local dev, leave `COOKIE_DOMAIN` empty and set `COOKIE_SECURE=false`.

4. First boot (builds images, runs migrations, seeds demo data):

   ```bash
   RUN_SEED=true docker compose up --build
   ```

5. After the first successful boot, press Ctrl+C then start normally:

   ```bash
   docker compose up -d
   ```

Open your browser at `localhost` on port 3000. You will be redirected to
`/login`.

> The first boot runs database migrations before the API starts, and the
> backend healthcheck allows a 60-second start period. `docker compose ps` can
> report `health: starting` for up to a minute on a cold start - this is
> expected, not a hang.

## Demo accounts (created when `RUN_SEED` is true)

The seed populates a full demo dataset for "Horizon Heights Academy". Every
non-admin account shares the same password.

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@sms.local` | `AdminDev2026!` | 
| Faculty (30) | `faculty01@horizon.local` ... `faculty30@horizon.local` | `SystemDefaultSecure2026!` |
| Staff (35) | `staff01@horizon.local` ... `staff35@horizon.local` | `SystemDefaultSecure2026!` |
| Student (300) | `student001@horizon.local` ... `student300@horizon.local` | `SystemDefaultSecure2026!` |

Attendance capture and gradebook entry are FACULTY-only - ADMIN is deliberately
rejected with 403 - so use a `faculty*` login to exercise those modules
(corrections via PATCH allow assigned FACULTY and ADMIN per V1 correction policy).

**V1 Correction Policy:**
Initial attendance capture and gradebook entry are restricted strictly to FACULTY (`requireRole(ROLES.FACULTY)`). Corrections to existing attendance and grade records (`PATCH /api/attendance/student/:studentId` and `PATCH /api/grades/:id`) are permitted for assigned FACULTY (subject to timetable allocation checks) and ADMIN (without allocation check), with all modifications recorded in the immutable audit log.

These credentials are defined in `sms-core-backend/prisma/seed.ts` and echoed in
the banner the seed prints when it finishes. Change them immediately after first
login, and never run the seed against real data.

## Health check

```bash
curl localhost:3000/api/health
# Expect JSON with success true, status healthy, db status connected, uptime.
```

## Useful commands

```bash
cd ~/sms-monorepo
docker compose logs -f backend                            # tail backend logs
docker compose logs -f frontend                           # tail frontend logs
docker compose exec backend sh                            # shell into backend container
docker compose exec postgres psql -U sms_user -d sms_db   # raw psql shell
./scripts/backup.sh                                       # gzipped pg_dump into ./backups/
./scripts/backup.sh list                                  # list existing backups
./scripts/backup.sh restore FILE                          # restore (interactive confirmation)
docker compose down                                       # stop (keeps Postgres data volume)
docker compose down -v                                    # stop AND wipe Postgres (resets DB)
```

## Development without Docker (faster iteration)

**Terminal 1 - backend:**

```bash
cd ~/sms-monorepo/sms-core-backend
cp .env.example .env       # set DATABASE_URL and the three secrets
npm install
npx prisma migrate dev
npx prisma db seed         # only on an empty DB
npm run dev                # backend listens on localhost port 5000
```

**Terminal 2 - frontend:**

```bash
cd ~/sms-monorepo/sms-core
npm install
NEXT_PUBLIC_API_URL="http://localhost:5000/api" BACKEND_URL="http://localhost:5000" npm run dev
# frontend on localhost port 3000
```

## Test / lint / type-check

**Backend:**

```bash
cd ~/sms-monorepo/sms-core-backend
npm run lint
npm run test             # vitest unit + supertest smoke
npm run test:coverage
npm run build            # tsc + tsc-alias; fails on type errors
```

**Frontend:**

```bash
cd ~/sms-monorepo/sms-core
npm run lint
npm run build            # Next.js production build (type-checks too)
```

## Environment variables

All compose-level variables are documented in `.env.example`. The backend
validates required variables at startup and refuses to boot if any are missing
or malformed.

| Variable | Description |
| --- | --- |
| `POSTGRES_PASSWORD` | DB password for `sms_user` (required) |
| `JWT_SECRET` | Signs access tokens, at least 16 chars (required) |
| `JWT_REFRESH_SECRET` | Signs refresh tokens, at least 16 chars, MUST differ (required) |
| `COOKIE_SECRET` | Signs httpOnly cookies, at least 16 chars (required) |
| `COOKIE_DOMAIN` | Cookie Domain attribute - LEAVE EMPTY for localhost |
| `COOKIE_SECURE` | `true` only over HTTPS; use `false` for local dev |
| `COOKIE_SAME_SITE` | `lax` (default), `strict`, or `none` |
| `CORS_ORIGINS` | Comma-separated allowed browser origins (default `http://localhost:3000`) |
| `RUN_SEED` | Run seed on container boot; set `true` only on first launch |

## Node version

`package.json` in both packages requires Node 20+ and npm 10+.

## Project status

Active development. See the commit history and issue tracker for the
current state of known defects and remediation work.
