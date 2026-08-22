#!/usr/bin/env bash
# SMS database backup — dumps the postgres service to backups/ and keeps the
# newest 14 dumps. Run manually or from cron (see PRODUCTION-CHECKLIST.md §7).
set -euo pipefail
cd "$(dirname "$0")/.."

STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="backups/sms_db_${STAMP}.sql.gz"

mkdir -p backups
docker compose exec -T postgres pg_dump -U sms_user -d sms_db | gzip > "$OUT"

echo "✅ backup written: ${OUT} ($(du -h "${OUT}" | cut -f1))"
# Retention: keep the newest 14 dumps
ls -1t backups/sms_db_*.sql.gz | tail -n +15 | xargs -r rm -f
echo "   retention: $(ls -1 backups/sms_db_*.sql.gz | wc -l) dump(s) kept (max 14)"
