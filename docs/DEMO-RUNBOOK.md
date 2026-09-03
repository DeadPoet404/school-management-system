# Demo Environment Runbook (sms-demo.jocomfy.com)

Sales / investor showcase running **only fake seeded data**. It is isolated
from production and staging on every axis: separate Supabase project, separate
Docker network/ports, separate secrets, capped lower, behind Cloudflare Access.

> **Guardrail:** the demo must NEVER point at the prod or staging database.
> The validator (`deploy/demo/validate-env.sh`) refuses to run unless the
> DATABASE_URL matches the demo project ref.

---

## 1. Prerequisites (one-time)

- You have a **dedicated Supabase project** for the demo (e.g. `sms-demo`).
  Free tier is fine. Save its database password. Note its **project ref**
  (e.g. `bgrmomfudlozpkdmlpdn`) and region host.
- Supabase **free projects pause after ~7 days idle** — before any
  presentation, hit the demo URL or the Supabase dashboard to wake it.
- A **Cloudflare account** with the `sms-demo.jocomfy.com` zone, and Zero
  Trust email one-time-PIN enabled (Settings → Authentication → Login methods →
  **One-time PIN**).

---

## 2. Create the demo env file (on the server)

```bash
sudo mkdir -p /etc/jocomfy-demo
sudo install -o root -g root -m 600 /dev/null /etc/jocomfy-demo/demo.env
sudo nano /etc/jocomfy-demo/demo.env   # paste + fill values
```

Fill from `deploy/demo/demo.env.example`. Key values:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://postgres.<ref>:<pw>@<host>.pooler.supabase.com:6543/postgres` |
| `DIRECT_URL` | same host but **:5432** (migrations/seed only) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` / `COOKIE_SECRET` | 3 distinct random ≥32-char secrets (`openssl rand -base64 48`) |
| `CORS_ORIGINS` | `https://sms-demo.jocomfy.com` |
| `COOKIE_SECURE` | `true` |

Leave every integration blank. Keep `RUN_SEED=false` until the one-time seed.

## 3. Validate + build + start (first boot)

```bash
cd /root/school-management-system
git pull origin main

ENVF=/etc/jocomfy-demo/demo.env
COMPOSE="docker compose --env-file $ENVF -f deploy/demo/docker-compose.yml"

bash deploy/demo/validate-env.sh          # expect: PASS
$COMPOSE config >/dev/null && echo "interpolation OK"
$COMPOSE build
$COMPOSE up -d demo-backend               # migrates on entrypoint (empty DB)
$COMPOSE ps
curl -sS http://127.0.0.1:5200/api/health
```

The backend entrypoint runs `prisma migrate deploy` against the demo DB and
starts the server.

### 4. Seed the demo database — AUTOMATIC, fake data only

Set `RUN_SEED=true` (and `FORCE_SEED=true` if the DB is not brand-new) in
`demo.env`, start `demo-backend`, and the entrypoint runs **both** seeds in
order automatically — the base org seed **then** the finance-history seed — so
the demo comes up **fully pre-filled** (school, accounts, students, staff,
invoices, collections, expenses, payroll, ledgers, billing). Investors log in
and browse; there is nothing to set up.

```bash
# In demo.env:
#   RUN_SEED=true
#   FORCE_SEED=true     # only needed if reseeding a DB that already has data

ENVF=/etc/jocomfy-demo/demo.env
COMPOSE="docker compose --env-file $ENVF -f deploy/demo/docker-compose.yml"

$COMPOSE up -d --force-recreate demo-backend
$COMPOSE logs -f demo-backend
# look for: Migrations complete → RUN_SEED=true … → Base seed complete →
#           Demo finance seed complete → Seed complete → Starting application server
```

When seeding finishes, flip both back to false so restarts never touch data:

```bash
sudo sed -i 's/^RUN_SEED=.*/RUN_SEED=false/' /etc/jocomfy-demo/demo.env
sudo sed -i 's/^FORCE_SEED=.*/FORCE_SEED=false/' /etc/jocomfy-demo/demo.env
$COMPOSE up -d                            # bring up the frontend
$COMPOSE ps
```

## 5. Add a DNS record (Cloudflare dashboard)

`Add record` for **sms-demo** pointing at the server IP (same as your other
`*.jocomfy.com` records — Caddy serves by Host). Grey-cloud or orange-cloud
both work since you'll gate with Access; keep **Proxied** on for Access to
work at the edge.

> **Networking (no manual steps):** `deploy/demo/docker-compose.yml` attaches
> the demo containers to the **external `sms-net` bridge that Caddy already
> sits on** (same one as production). So Caddy reaches `demo-backend:5200` and
> `demo-frontend:3000` by name with no `docker network connect` and no manual
> rewiring after `up`/recreates/reboots. If that network is ever renamed, set
> `SMS_DOCKER_NETWORK` to its name.

## 6. Add the route to Caddy

Edit the Caddyfile that already proxies your other hosts (you found it at
`/root/…/jocomfy-site/Caddyfile` or wherever your caddy project lives). Add a
host block mirroring `sms-staging` but pointing at the demo containers:

```
sms-demo.jocomfy.com {
    import common_security

    header {
        X-Robots-Tag "noindex, nofollow, noarchive"
    }

    route {
        @not_cloudflare not remote_ip 173.245.48.0/20 103.21.244.0/22 103.22.200.0/22 103.31.4.0/22 141.101.64.0/18 108.162.192.0/18 190.93.240.0/20 188.114.96.0/20 197.234.240.0/22 198.41.128.0/17 162.158.0.0/15 104.16.0.0/13 104.24.0.0/14 172.64.0.0/13 131.0.72.0/22 2400:cb00::/32 2606:4700::/32 2803:f800::/32 2405:b500::/32 2405:8100::/32 2a06:98c0::/29 2c0f:f248::/32
        respond @not_cloudflare "Direct demo-origin access is not permitted." 403

        @api path /api /api/*
        reverse_proxy @api demo-backend:5200

        reverse_proxy demo-frontend:3000
    }
}
```

Then reload Caddy:

```bash
docker exec jocomfy-site-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec jocomfy-site-caddy-1 caddy reload   --config /etc/caddy/Caddyfile
```

(The exact Caddy container/paths depend on how your caddy is mounted; match
how you already edit the file for the other hosts.)

## 7. Gate it with Cloudflare Access (email one-time PIN)

In Cloudflare Zero Trust:

1. **Access → Applications → Add an application** → Self-hosted.
2. Domain: `sms-demo.jocomfy.com`, name "SMS Demo".
3. **Policy:** Allow. Login method **Email — One-time PIN**. Include the
   investors' email addresses (add each as a value, e.g. `investor@example.com`
   or a whole company domain).
4. Save. Now `https://sms-demo.jocomfy.com` shows the Access prompt; a listed
   email gets a magic code, then reaches the app login.

To revoke someone later: remove their email from the policy (or add a Block
policy above Allow).

## 8. Verify the full demo

- Sign in with the seeded **admin** account: `admin@sms.local` /
  `AdminDev2026!` (from the base seeder). Demo staff share the default
  password from the seed.
- Walk the modules: `/dashboard`, `/finance` (dashboard + Financial Ledgers +
  the create/record/export tools you wired), `/students`, `/staff`,
  `/teachers`, `/operations`.
- The finance screens should show the seeded history (invoices/collections/
  expenses/payroll) so it looks lived-in.

## 9. Hand out access

Give an investor the URL `https://sms-demo.jocomfy.com`. Their first visit
prompts for their email → they receive a one-time code → they sign into the
app with the demo admin credentials you provide. You control both layers
(Access list + app login) and can revoke either at any time.

## Day-to-day / maintenance

- **Restart demo:** `$COMPOSE restart demo-backend demo-frontend`
- **Rebuild after a code change:** `git pull` then `$COMPOSE build` +
  `$COMPOSE up -d`
- **Re-seed the demo to refresh fake data:** set `RUN_SEED=true` and
  `FORCE_SEED=true` in `demo.env`, run
  `$COMPOSE up -d --force-recreate demo-backend`, wait for the logs to show
  both seeds complete, then flip both back to `false` and `$COMPOSE up -d`.
- **Remove the whole demo:** `$COMPOSE down` (removes containers; the external
  `sms-net` is left alone since prod shares it), delete the Caddy block + DNS
  record + Access app, and delete/disable the Supabase project.

## Rolling back / deleting

Same as prod but scoped: checkout the previous commit, `$COMPOSE build`
`demo-backend demo-frontend`, `up -d`. Or tear down entirely per above.
