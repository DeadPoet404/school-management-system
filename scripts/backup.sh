#!/usr/bin/env bash
#
# SMS Database Backup / Restore Script
#
# Usage:
#   ./scripts/backup.sh                # Create a compressed backup
#   ./scripts/backup.sh list           # List existing backups
#   ./scripts/backup.sh restore <file> # Restore from a backup file
#
# Backups are stored in ./backups/ at the monorepo root.
# Requires: docker compose (or docker-compose), gzip

set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${COMPOSE_DIR}/backups"
CONTAINER_NAME="sms-monorepo-postgres-1"

# Fallback: try docker-compose v1 container naming
if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    CONTAINER_NAME="sms-monorepo_postgres_1"
fi

if ! docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    echo "ERROR: PostgreSQL container not found. Start it with: docker compose up -d postgres" >&2
    exit 1
fi

mkdir -p "$BACKUP_DIR"

# Read credentials — defaults match docker-compose.yml
DB_NAME="${POSTGRES_DB:-sms_db}"
DB_USER="${POSTGRES_USER:-sms_user}"
DB_PASS="${POSTGRES_PASSWORD:-smspass}"

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
BACKUP_FILE="${BACKUP_DIR}/sms-backup-${TIMESTAMP}.sql.gz"

case "${1:-backup}" in
    backup)
        echo ">>> Backing up database '${DB_NAME}' from container '${CONTAINER_NAME}'..."
        docker exec "$CONTAINER_NAME" \
            pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
            | gzip > "$BACKUP_FILE"
        SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        echo ">>> Backup complete: ${BACKUP_FILE} (${SIZE})"
        ;;

    list)
        echo ">>> Existing backups in ${BACKUP_DIR}/:"
        ls -lht "${BACKUP_DIR}"/sms-backup-*.sql.gz 2>/dev/null || echo "    (none found)"
        ;;

    restore)
        if [ -z "${2:-}" ]; then
            echo "ERROR: Specify backup file to restore." >&2
            echo "  Usage: $0 restore <backup-file>" >&2
            echo "  Use '$0 list' to see available backups." >&2
            exit 1
        fi
        RESTORE_FILE="$2"
        if [ ! -f "$RESTORE_FILE" ]; then
            echo "ERROR: File not found: ${RESTORE_FILE}" >&2
            exit 1
        fi
        echo "!!! WARNING: This will DROP and recreate all objects in '${DB_NAME}' !!!"
        read -rp "Type the database name '${DB_NAME}' to confirm: " CONFIRM
        if [ "$CONFIRM" != "$DB_NAME" ]; then
            echo "Aborted." >&2
            exit 1
        fi
        echo ">>> Restoring ${RESTORE_FILE} to '${DB_NAME}'..."
        gunzip -c "$RESTORE_FILE" | docker exec -i "$CONTAINER_NAME" \
            psql -U "$DB_USER" -d "$DB_NAME" --quiet --set ON_ERROR_STOP=1
        echo ">>> Restore complete."
        ;;

    *)
        echo "Usage: $0 {backup|list|restore <file>}" >&2
        exit 1
        ;;
esac
