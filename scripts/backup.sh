#!/usr/bin/env bash
# SMS database backup — dumps the database to backups/ and keeps the newest
# 14 dumps. Run manually or from cron (see PRODUCTION-CHECKLIST.md §7).
#
# DATABASE PROVIDER: Supabase Postgres (managed).
#   • Supabase keeps automatic daily backups on its own infra; this script
#     produces an additional portable pg_dump that you fully control.
#   • It connects over DIRECT_URL (direct connection, port 5432) — the
#     transaction pooler cannot serve pg_dump.
#   • Override the target with BACKUP_DB_URL (e.g. to dump an old local
#     Postgres while migrating data into Supabase).
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."

# ── Subcommands that never need a database connection ──
case "${1:-}" in
  list)
    ls -1t backups/sms_db_*.sql.gz 2>/dev/null || echo "(no backups yet)"
    exit 0
    ;;
  restore)
    FILE="${2:-}"
    if [ -z "$FILE" ]; then
      echo "usage: $0 restore backups/sms_db_<timestamp>.sql.gz" >&2
      exit 1
    fi
    ;;
  "")
    ;;
  *)
    echo "usage: $0 [list|restore FILE]" >&2
    exit 1
    ;;
esac

# ── Resolve the connection URL ──
DB_URL="${BACKUP_DB_URL:-}"
if [ -z "$DB_URL" ] && [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a; . ./.env; set +a
  DB_URL="${DIRECT_URL:-${DATABASE_URL:-}}"
fi
if [ -z "$DB_URL" ]; then
  echo "❌ No database URL found. Set DIRECT_URL or DATABASE_URL in .env, or BACKUP_DB_URL in the environment." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  echo "❌ pg_dump/psql not found. Install postgresql-client, or use: npx supabase db dump" >&2
  exit 1
fi

# libpq (pg_dump/psql) rejects Prisma-only URI query parameters such as
# ?pgbouncer=true&connection_limit=1 — prune them before connecting.
# Everything else (sslmode, connect_timeout, ...) is passed through untouched.
sanitize_uri() {
  local url="$1" base query kv key keep=""
  base="${url%%\?*}"
  [[ "$url" == *\?* ]] || { printf '%s' "$url"; return 0; }
  query="${url#*\?}"
  local IFS='&'
  for kv in $query; do
    key="${kv%%=*}"
    case "$key" in
      pgbouncer|connection_limit|pool_timeout|schema|socket_timeout|statement_cache_size) ;;
      *) keep+="${keep:+&}${kv}" ;;
    esac
  done
  printf '%s' "${base}${keep:+?${keep}}"
}
DB_URL="$(sanitize_uri "$DB_URL")"
export DB_URL  # forwarded into the container when the docker fallback fires

# ── pg_dump must not be OLDER than the server's major version ──
# pg_dump aborts on a newer server ("server version mismatch"). Supabase runs
# Postgres 17 while e.g. Ubuntu 24.04 ships client 16. Resolution order:
#   1. tools on PATH   2. newest /usr/lib/postgresql/*/bin (PGDG installs)
#   3. docker postgres:<server-major>-alpine   4. fail with instructions
pg_major_of() { "$1" --version 2>/dev/null | grep -oE '[0-9]+(\.[0-9]+)?' | head -n1 | cut -d. -f1; }

SRV_MAJOR="$(psql -tA "$DB_URL" -c "select current_setting('server_version_num')::int / 10000" 2>/dev/null)"

PGDUMP=""
PSQL=""
pick_host_tools() {
  local cand=() c m d
  command -v pg_dump >/dev/null 2>&1 && cand+=("$(command -v pg_dump)")
  for d in $(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -rV); do
    [ -x "$d/pg_dump" ] && cand+=("$d/pg_dump")
  done
  for c in "${cand[@]}"; do
    m="$(pg_major_of "$c")"
    if [ -n "$m" ] && { [ -z "$SRV_MAJOR" ] || [ "$m" -ge "$SRV_MAJOR" ]; }; then
      PGDUMP="$c"
      PSQL="$(dirname "$c")/psql"; [ -x "$PSQL" ] || PSQL="$(command -v psql)"
      return 0
    fi
  done
  return 1
}

DOCKER_MODE=0
IMG=""
if ! pick_host_tools; then
  if command -v docker >/dev/null 2>&1 && [ -n "$SRV_MAJOR" ]; then
    DOCKER_MODE=1
    IMG="postgres:${SRV_MAJOR}-alpine"
    echo "ℹ️  host pg_dump is older than server ${SRV_MAJOR} — using docker ${IMG} (first run pulls the image)" >&2
  else
    echo "❌ pg_dump is older than the server (${SRV_MAJOR:-unknown}) and no docker fallback available." >&2
    echo "   Install matching client via PGDG, e.g.:" >&2
    echo "     sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh" >&2
    echo "     sudo apt-get install -y postgresql-client-${SRV_MAJOR:-17}" >&2
    exit 1
  fi
fi

# Dump only the application-owned public schema. Supabase-managed schemas,
# roles, ownership declarations, and grants are excluded so the result can
# be restored into ordinary PostgreSQL.
PG_DUMP_ARGS=(
  --schema=public
  --no-owner
  --no-privileges
  --format=plain
)

# Credentials ride in the URL env/args — same local exposure class as the
# previous host-side invocation (docker group == host root).
run_pg_dump() {
  if [ "$DOCKER_MODE" = 1 ]; then
    docker run --rm -i --network host -e DB_URL "$IMG"       pg_dump "${PG_DUMP_ARGS[@]}" "$DB_URL"
  else
    "$PGDUMP" "${PG_DUMP_ARGS[@]}" "$DB_URL"
  fi
}
run_psql_stdin() {  # SQL is piped in on stdin
  if [ "$DOCKER_MODE" = 1 ]; then
    docker run --rm -i --network host -e DB_URL "$IMG" psql -v ON_ERROR_STOP=1 "$DB_URL"
  else
    "$PSQL" -v ON_ERROR_STOP=1 "$DB_URL"
  fi
}

# Password-free echo of the target for logs
MASKED_URL="$(printf '%s' "$DB_URL" | sed -E 's#(://)[^@]+@#\1***@#')"

# ── Restore ──
if [ "${1:-}" = "restore" ]; then
  if [ ! -f "$FILE" ]; then
    echo "❌ $FILE not found" >&2
    exit 1
  fi
  echo "⚠️  About to restore ${FILE} into: ${MASKED_URL}"
  echo "    The dump contains CREATE statements — this is destructive on a"
  echo "    database that already holds the schema."
  read -rp "    Type RESTORE to continue: " CONFIRM
  if [ "$CONFIRM" != "RESTORE" ]; then
    echo "aborted."
    exit 1
  fi
  gunzip -c "$FILE" | run_psql_stdin
  echo "✅ restored: ${FILE}"
  exit 0
fi

# ── Create backup (default) ──
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="backups/sms_db_${STAMP}.sql.gz"

mkdir -p backups
run_pg_dump | gzip > "$OUT"
chmod 600 "$OUT"

echo "✅ backup written: ${OUT} ($(du -h "${OUT}" | cut -f1)) from ${MASKED_URL}"
# Retention: keep the newest 14 dumps
ls -1t backups/sms_db_*.sql.gz | tail -n +15 | xargs -r rm -f
echo "   retention: $(ls -1 backups/sms_db_*.sql.gz | wc -l) dump(s) kept (max 14)"
