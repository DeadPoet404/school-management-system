# Supabase Cutover Runbook

How this repo's database moved from a local Docker Postgres to
**Supabase-managed Postgres** — the exact procedure, and the five failure
modes that were fixed along the way (each is a commit on `main`).

Use this when onboarding a new host, re-running env setup, or restoring
backups. For full production go-live (HTTPS, domains, hardening) see
[PRODUCTION-CHECKLIST.md](../PRODUCTION-CHECKLIST.md).

---

## 1 · Connection architecture

```
Express runtime ──► DATABASE_URL  = transaction pooler :6543  (hot path queries)
Prisma CLI / pg_dump ─► DIRECT_URL = session pooler :5432     (DDL + dumps)
                                   or db.<ref>.supabase.co:5432 when IPv6 exists
```

- The **transaction pooler (6543) refuses DDL and pg_dump** — anything that
  runs migrations or backups MUST use `DIRECT_URL`.
- `db.<ref>.supabase.co` (direct) is **IPv6-only**; most networks (incl. many
  Ghanaian ISPs) need the **session pooler** `aws-0-<region>.pooler.supabase.com:5432`.
  `supabase_env_setup.py` auto-detects this (TCP-connects to the IPv6 host first).
- URLs are **double-quoted in .env** — `&` in `DATABASE_URL` otherwise
  backgrounds the assignment when a shell sources the file
  (`set -a && . ./.env`, which `scripts/backup.sh` does).

## 2 · Fresh host setup

```bash
python3 supabase_env_setup.py     # writes BOTH .env files, rotates secrets, hides pw input
python3 env_inspect.py            # expect RESULT: OK (pw_len == dashboard password length)
cd sms-core-backend
set -a && . ./.env && set +a      # quoted URLs make this safe now
node ../probe_supabase.js "$DATABASE_URL" "$DIRECT_URL"   # expect OK OK (real P-code hints on failure)
npx prisma migrate deploy
cd .. && docker compose up -d --build
curl -s http://127.0.0.1:5000/api/health     # db.status == connected
```

Secrets are personal; `.env` files are git-ignored. If the Supabase project is
**paused** (free tier, ~7 days idle) probes report `[P1001]` — restore it in
the dashboard and retry.

## 3 · Importing data from the legacy local Postgres

Pre-flight gates: equal `_prisma_migrations` counts on both sides; Supabase
tables empty. Then:

```bash
# dump (data-only, skip Prisma's bookkeeping table)
docker exec <legacy-container> pg_dump -U sms_user -d sms_db \
  --data-only -T '_prisma_migrations' | gzip > backups/local_legacy_copy_$(date +%F_%H%M).sql.gz

# atomic load — single transaction, FK checks suspended, keepalives detect
# dead links in ~90 s instead of hanging:
CLEAN_URL="$(printf '%s' "$DIRECT_URL" | sed -E \
  's/(\?|&)(pgbouncer|connection_limit|pool_timeout|schema|socket_timeout|statement_cache_size)=[^&]*//g; s/\?$//')"
FAST_URL="${CLEAN_URL}?keepalives_idle=60&keepalives_interval=10&keepalives_count=3"
{
  echo "SET session_replication_role = 'replica';"
  gunzip -c <dump>
  echo "RESET session_replication_role;"
} | psql -1 -v ON_ERROR_STOP=1 "$FAST_URL"          # all-or-nothing: COMMIT or full rollback

# verify: row-count parity + md5 fingerprints per table, e.g.
psql "$CLEAN_URL" -t -c "SELECT md5(string_agg(id, ',' ORDER BY id)) FROM \"Student\";"
```

Use `COPY` format dumps for WAN loads: row-wise `--column-inserts` costs one
round-trip **per row** and dies on flaky links; COPY streams whole tables.
(The schema uses `uuid()` string PKs — no sequences to resync after load.)

## 4 · Backups & restore

```bash
./scripts/backup.sh            # dump → backups/ (retention: newest 14)
./scripts/backup.sh list
./scripts/backup.sh restore backups/<file>.sql.gz   # asks for RESTORE
```

`backup.sh` automatically: strips Prisma-only URI params for libpq, detects
the **server's** major version, and falls back to
`docker run postgres:<major>-alpine` when host `pg_dump` is older or absent —
so any host with Docker can dump.

Nightly cron (see PRODUCTION-CHECKLIST §7):

```cron
0 2 * * * /home/<user>/sms-monorepo/scripts/backup.sh >> /var/log/sms-backup.log 2>&1
```

## 5 · Pitfall table (all fixed on main)

| Symptom | Cause | Fix (commit subject) |
| --- | --- | --- |
| `migrate deploy` DNS/timeout, backups die | nonexistent `DIRECT_URL` host shape in templates | fix(env): repair Supabase env tooling for the cutover |
| env vars silently vanish after sourcing | unquoted `&` in `DATABASE_URL` backgrounds assignment | 〃 |
| probe prints `FAIL` with no reason | Prisma errors start with a blank line | fix(probe): surface real Prisma errors |
| `pg_dump: invalid URI query parameter: "pgbouncer"` | libpq rejects Prisma-only params | fix(backup): strip Prisma-only URI params |
| `server version mismatch` (17 vs 16) | host client older than Supabase's Postgres | fix(backup): auto-match pg_dump major version |

Supabase additionally keeps its own automatic daily backups; our `pg_dump`
copies are the portable, self-controlled layer.
