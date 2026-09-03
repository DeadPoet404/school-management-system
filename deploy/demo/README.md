# Demo Environment (sms-demo.jocomfy.com)

A sales/investor showcase environment running **only fake, seeded data**. It is
NOT connected to production or staging in any way, and never should be.

- Runs the same `sms-core` frontend + `sms-core-backend` images as everywhere
  else, but on a **separate Docker network and ports**, capped lower than
  production so it can never starve the host.
- Points at a **dedicated Supabase project** (`sms-demo`) that you seed once
  with the base seeder **plus** `demo-finance-seed.ts` for a rich, month-spread
  finance history (so the dashboards and ledgers you built look lived-in).
- Sits behind Cloudflare Access (email one-time PIN) for the investors you add.
  It is gated, not public.

## Layout

- `deploy/demo/docker-compose.yml` — `demo-backend` (512m / 0.75 CPU) and
  `demo-frontend` (384m / 0.5 CPU), isolated network, private host ports.
- `deploy/demo/demo.env.example` — copy to `/etc/jocomfy-demo/demo.env`.
- `deploy/demo/validate-env.sh` — sanity checks before you deploy.
- `sms-core-backend/prisma/demo-finance-seed.ts` — extra fake finance history
  for the demo DB (run **after** the base seed, against the same empty DB).

## One-time setup

See `docs/DEMO-RUNBOOK.md` for the full step-by-step (DB, DNS, Caddy,
Cloudflare Access, seeding, walkthrough).
