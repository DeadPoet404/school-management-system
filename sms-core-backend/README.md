# sms-core-backend (Backend API)
Node.js 20 + Express REST API for the School Management System.
Written in TypeScript, uses Prisma ORM (via Prisma) against PostgreSQL 16.

## Tech stack
  - Runtime         : Node.js 20+
  - Language        : TypeScript 5
  - Framework       : Express 4 (REST)
  - ORM             : Prisma 5
  - Database        : PostgreSQL 16
  - Validation      : Zod 4
  - Auth            : JWT (jsonwebtoken), bcryptjs password hashing
  - Logging         : pino structured JSON logs + pino-http
  - Security        : helmet, cors allowlist, cookie-parser,
                     express-rate-limit, recursive XSS sanitizer
  - Docs            : swagger-ui-express (NODE_ENV=development only)
  - Testing         : Vitest 4 + supertest + coverage-v8
  - Package mgr      : npm 10+ (package-lock.json committed)

## Running locally

  cd ~/sms-monorepo/sms-core-backend
  cp .env.example .env
    # set DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, COOTIE_SECRET
  npm install
  npx prisma generate
  npx prisma migrate dev
  npm run seed       # only on an empty database
  npm run dev        # ts-node-dev, port 5000 by default
Production:
  npm run build     # tsc + tsc-alias -> dist/
  npm start          # node dist/app.js

Docker: see Dockerfile and parent docker-compose.yml. Entrypoint waits
for Postgres, runs "prisma migrate deploy", optionally seeds, boots.

## Environment variables

Required (validated at startup by src/lib/env.ts; server refuses to
boot if any are missing or malformed):

  DATABASE_URL        PostgreSQL connection string
  JWT_SECRET        access token signing key (min 16 chars)
  JWT_REFRESH_SECRET  refresh token signing key (min 16 chars, MUST
                      differ from JWT_SECRET)
  COOTIE_SECRET       cookie signing secret (min 16 chars)

Optional (with safe defaults):

  NODE_ENV                development | production | test
  PORT                   TCP port (default 5000)
  JWT_ACCESS_EXPIRES_IN    access token lifetime (default 15m)
  JWT_REFRESH_EXPIRES_IN   refresh token lifetime (default 7d)
  COOKIE_DOMAIN            leave EMPTY for localhost
  COOTIE_SECURE            true only over HTTPS (default false)
  COOKIE_SAME_SITE        lax | strict | one (default lax)
  CORS_ORIGINS             comma-separated origins (default localhost:3000)
  RATE_LIMIT_WINDOW_MS     global rate limit window (default 60000)
  RATE_LIMIT_MAX_REQUESTS  global rate limit (default 100/window)
  AUTH_RATE_LIMIT_MAX_REQUESTS  /api/auth/* stricter limit (default 5)
  LOG_LEVEL               fatal | error | warn | info | debug | trace

## Folder layout

  src/
    app.ts              Bootstrap: middleware stack + route mounting
    lib/
      env.ts           Startup env validation (Zod), fail-fast
      prisma.ts          Shared PrismaClient singleton
      logger.ts         pino logger
      swagger.ts        OpenAPI/Swagger spec
      token-blocklist.ts  In-memory access-token revoke list
    middleware/
      auth.middleware.ts   JWT cookie auth + blocklist/invalidation
      rbac.middleware.ts   Role-based access control (requireRole)
      validate.ts          Zod body validation
      xss.middleware.ts    Recursive HTML strip on body/query/params
      audit.middleware.ts  Async AuditLog write for writes
      error.handler.ts     Global error handler + AppError class
    modules/            One folder per feature slice:
      auth/            login, refresh, logout, me
      students/     CRUD, enrollment, departure, financial matrix
      teachers/        CRUD, onboarding, departure
      staff/        CRUD, departure, workforce matrix
      timetable/     per-section timetable config
      finance/       fees, invoices, payments, ledgers, expenses, payroll
      attendance/    section attendance submission + rate recompute
      grades/        grade entry with weighted GPA recompute
      Each module has: *.routes.ts, *.controller.ts, *.service.ts,
      *.repository.ts, *.validation.ts.
    types/             Shared TypeScript types
    utils/            hash, pagination, CSV export, ID generation, etc
    constants/        grade-boundaries map
    scripts/          CLI utils (check-accounts, check-orphans, reset-pw,
                      cleanup-expired-tokens, seed)
    __tests__/       Vitest unit + supertest smoke (e2e)
  prisma/
    schema.prisma     Single source of truth for DB schema
    seed.ts           Demo data seeder (admin + demo entities)
    migrations/      25 Prisma migrations tracking schema evolution

## API overview

Public endpoints (under /api):
  GET    /api/health        Db connectivity + uptime
  GET   /api/docs         Swagger UI (dev only)
  POST  /api/auth/login  Sets httpOnly cookies
  POST  /api/auth/refresh Rotates refresh token
  POST  /api/auth/logout Revokes refresh, clears cookies

All other endpoints require a valid access_token cookie and an allowed
role. Key protected routes:
  GET    /api/student[/:id][/finance]
  POST   /api/students                     enrollment (multi-table tx)
  POST   /api/students/departure          offboard a student
  PATCH  /api/students/:id                partial update
  GET    /api/teachers[/:id]
  POST   /api/teachers                     onboarding (temp password)
  POST   /api/teachers/departure
  PATCH  /api/teachers/:id
  GET    /api/staff[/:id][/matrix]
  POST   /api/staff
  POST   /api/staff/departure
  PATCH :/api/staff/:id
  GET/POST/api/timetable/matrix           get/replace timetable
  GET/POST /api/finance/fee-structures
  GET/POST /api/finance/collections
  GET    /api/finance/collections/:sectionId
  GET    /api/finance/students-by-section/:sectionId
  POST   /api/finance/generate-invoices
  GET    /api/finance/invoices
  GET    /api/finance/expenses
  POST   /api/finance/expenses
  GET/POST /api/finance/ledgers
  GET/PATCH /api/finance/payroll
  POST   /api/attendance/section           bulk attendance (FACULTY)
  POST   /api/grades/submit                grade entry + GPA recompute

Paginated lists accept ?page=1&limit=20 and return:
  { success:true, data:[...], pagination:{page,limit,totalItems,totalPages} }
Append ?format=csv for a CSV download.

## Auth details

  - Access tokens signed with JWT_SECRET (HS256), 15 min, httpOnly cookie.
  - Refresh tokens signed with JWT_REFRESH_SECRET (separate key), 7 day,
    DF-backed, single-use rotation.
  - 5 failed logins triggers a 15-minute per-email lockout, on top of
    the IP rate limiter.
  - Roles: STUDENT, STAFF, FACULTY, ADMIN, ACCOUNTANT.

## Database workflow

  Edit prisma/schema.prisma, then:
    npx prisma migrate dev --name descriptive_name
  Reset + reseed dev DB:
    npx prisma migrate reset
    npm run seed
  Deploy migrations to a production-style DB:
    npx prisma migrate deploy

## Useful scripts

  npm run dev             watch mode (ts-node-dev)
  npm run build           compile to dist/
  npm start               run compiled output
  npm run lint           ESLint
  npm run lint:fix        ESLint --fix + Prettier
  npm run test            Vitest (unit + e2e smoke)
  npm run test:watch     Vitest watch
  npm run test:coverage  coverage report under coverage/
  npm run seed            run seed script
  npx prisma studio        visual DB browser at localhost:5555

## Testing

Unit tests under src/__tests__/unit cover auth middleware, error
handler, RBAC, auth/finance/student services, hash and pagination
utils. The e2e smoke test uses supertest with the in-process Express
app and a mocked Prisma client to verify health, auth validation, and
401 behavior on protected routes.
