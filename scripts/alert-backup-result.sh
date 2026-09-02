#!/usr/bin/env bash
# ExecStopPost hook for the backup units. systemd sets $SERVICE_RESULT and
# $EXIT_STATUS. Success is reported so the weekly restore verification is
# visibly happening rather than merely assumed; failure is left to the
# OnFailure= handler, which has the journal tail.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT="${1:-backup}"
RESULT="${SERVICE_RESULT:-unknown}"

# Only announce clean completions here.
[ "$RESULT" = "success" ] || exit 0

case "$UNIT" in
  *verify*)
    "$ROOT/scripts/alert.sh" OK "Backup restore verification passed" \
      "unit: $UNIT" \
      "The most recent dump restored into a disposable database and reported table counts."
    ;;
  *)
    LATEST="$(find "$ROOT/backups" -maxdepth 1 -type f -name 'sms_db_*.sql.gz' \
      -printf '%T@ %s %p\n' 2>/dev/null | sort -nr | head -n1)"
    SIZE_MB="$(printf '%s' "$LATEST" | awk '{printf "%.1f", $2/1048576}')"
    COUNT="$(find "$ROOT/backups" -maxdepth 1 -type f -name 'sms_db_*.sql.gz' 2>/dev/null | wc -l)"

    "$ROOT/scripts/alert.sh" OK "Encrypted backup uploaded to R2" \
      "unit: $UNIT" \
      "latest dump size: ${SIZE_MB:-unknown} MB" \
      "local dumps retained: ${COUNT}"
    ;;
esac
