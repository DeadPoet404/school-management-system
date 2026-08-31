#!/usr/bin/env bash
# Restore a compressed SMS SQL backup into a temporary PostgreSQL container.
# This script never connects to or modifies the production database.
set -euo pipefail
umask 077

cd "$(dirname "$0")/.."

FILE="${1:-}"

if [ -z "$FILE" ]; then
  FILE="$(ls -1t backups/sms_db_*.sql.gz 2>/dev/null | head -n 1 || true)"
fi

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "ERROR: Backup file not found." >&2
  echo "Usage: $0 [backups/sms_db_TIMESTAMP.sql.gz]" >&2
  exit 1
fi

gzip -t "$FILE"

DUMP_MAJOR="$(
  gzip -cd "$FILE" |
    awk '
      !found && /^-- Dumped from database version / {
        line = $0
        sub(/^-- Dumped from database version /, "", line)
        split(line, parts, ".")
        print parts[1]
        found = 1
      }
    '
)"

if [ -z "$DUMP_MAJOR" ]; then
  echo "ERROR: Cannot determine PostgreSQL major version." >&2
  exit 1
fi

CONTAINER="sms-backup-verify-$$"
LOG_FILE="$(mktemp)"
IMAGE="postgres:${DUMP_MAJOR}-alpine"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -f "$LOG_FILE"
}

trap cleanup EXIT

echo "Backup: $FILE"
echo "Test image: $IMAGE"

docker run \
  --detach \
  --name "$CONTAINER" \
  --env POSTGRES_USER=postgres \
  --env POSTGRES_PASSWORD=restore-test-only \
  --env POSTGRES_DB=sms_restore \
  --tmpfs /var/lib/postgresql/data:rw,nosuid,size=2g \
  "$IMAGE" \
  >/dev/null

READY=false

for _attempt in $(seq 1 30); do
  if docker exec "$CONTAINER" \
    pg_isready -U postgres -d sms_restore \
    >/dev/null 2>&1
  then
    READY=true
    break
  fi

  sleep 2
done

if [ "$READY" != "true" ]; then
  echo "ERROR: Temporary PostgreSQL did not become ready." >&2
  docker logs "$CONTAINER" >&2
  exit 1
fi

echo "Temporary database: READY"
echo "Dropping the temporary database's default public schema..."

docker exec "$CONTAINER" \
  psql \
  -v ON_ERROR_STOP=1 \
  -U postgres \
  -d sms_restore \
  -c 'DROP SCHEMA IF EXISTS public CASCADE;' \
  >/dev/null

echo "Restoring backup..."

if ! gzip -cd "$FILE" |
  docker exec -i "$CONTAINER" \
    psql \
    -v ON_ERROR_STOP=1 \
    -U postgres \
    -d sms_restore \
    >"$LOG_FILE" 2>&1
then
  echo "ERROR: Restore failed." >&2
  tail -n 100 "$LOG_FILE" >&2
  exit 1
fi

TABLE_COUNT="$(
  docker exec "$CONTAINER" \
    psql \
    -tA \
    -U postgres \
    -d sms_restore \
    -c "
      SELECT COUNT(*)
      FROM pg_tables
      WHERE schemaname = 'public';
    "
)"

if [ "$TABLE_COUNT" -lt 1 ]; then
  echo "ERROR: No public application tables were restored." >&2
  exit 1
fi

echo "Restore execution: PASS"
echo "Public tables restored: $TABLE_COUNT"

echo
echo "=== RESTORED RECORD COUNTS ==="

docker exec "$CONTAINER" \
  psql \
  -v ON_ERROR_STOP=1 \
  -U postgres \
  -d sms_restore \
  -c "
    SELECT 'Students' AS entity, COUNT(*) AS records
    FROM public.\"Student\"

    UNION ALL

    SELECT 'Teachers', COUNT(*)
    FROM public.\"Teacher\"

    UNION ALL

    SELECT 'Staff', COUNT(*)
    FROM public.\"Staff\"

    UNION ALL

    SELECT 'Migrations', COUNT(*)
    FROM public.\"_prisma_migrations\";
  "

echo
echo "Backup restore verification: PASS"
