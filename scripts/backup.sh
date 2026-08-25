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
  gunzip -c "$FILE" | psql -v ON_ERROR_STOP=1 "$DB_URL"
  echo "✅ restored: ${FILE}"
  exit 0
fi

# ── Create backup (default) ──
STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="backups/sms_db_${STAMP}.sql.gz"

mkdir -p backups
pg_dump "$DB_URL" | gzip > "$OUT"

echo "✅ backup written: ${OUT} ($(du -h "${OUT}" | cut -f1)) from ${MASKED_URL}"
# Retention: keep the newest 14 dumps
ls -1t backups/sms_db_*.sql.gz | tail -n +15 | xargs -r rm -f
echo "   retention: $(ls -1 backups/sms_db_*.sql.gz | wc -l) dump(s) kept (max 14)"
