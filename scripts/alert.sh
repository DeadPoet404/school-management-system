#!/usr/bin/env bash
# Jocomfy alert dispatcher — sends an operational notification to Telegram.
#
# Usage:
#   scripts/alert.sh LEVEL "Title" "Body line 1" ["Body line 2" ...]
#
#   LEVEL: OK | WARN | FAIL
#
# Configuration lives OUTSIDE the repository, at mode 600:
#   /etc/jocomfy-alert/alert.env
#     TELEGRAM_BOT_TOKEN=...
#     TELEGRAM_CHAT_ID=...
#     ALERT_HOSTNAME=production        # optional label
#     ALERT_ENABLED=true               # set false to mute without uninstalling
#
# NEVER pass student, guardian, or employee identifiers to this script.
# Alerts are aggregate operational facts only: unit names, exit codes,
# counters, thresholds. Telegram is a third-party service.
#
# Exit status is always 0. A failing alert channel must never cascade into
# a failing service unit.
set -uo pipefail

ALERT_ENV_FILE="${ALERT_ENV_FILE:-/etc/jocomfy-alert/alert.env}"

LEVEL="${1:-FAIL}"
TITLE="${2:-Unspecified alert}"
shift 2 2>/dev/null || true

if [ -f "$ALERT_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ALERT_ENV_FILE"
  set +a
fi

if [ "${ALERT_ENABLED:-true}" != "true" ]; then
  exit 0
fi

HOST_LABEL="${ALERT_HOSTNAME:-$(hostname -s 2>/dev/null || echo unknown)}"
STAMP="$(TZ=Africa/Accra date '+%Y-%m-%d %H:%M:%S %Z')"

case "$LEVEL" in
  OK)   ICON="✅" ;;
  WARN) ICON="⚠️" ;;
  *)    ICON="🔴" ; LEVEL="FAIL" ;;
esac

BODY=""
for line in "$@"; do
  BODY="${BODY}${line}"$'\n'
done

MESSAGE="${ICON} ${LEVEL} — ${TITLE}
host: ${HOST_LABEL}
time: ${STAMP}"

if [ -n "$BODY" ]; then
  MESSAGE="${MESSAGE}

${BODY}"
fi

# Always leave a trace in the journal even when Telegram is unreachable.
echo "[alert:${LEVEL}] ${TITLE}"

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "[alert] Telegram not configured ($ALERT_ENV_FILE) — notification not sent." >&2
  exit 0
fi

HTTP_CODE="$(
  curl \
    --silent \
    --show-error \
    --max-time 15 \
    --retry 2 \
    --retry-delay 3 \
    --output /dev/null \
    --write-out '%{http_code}' \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=${MESSAGE}" \
    --data-urlencode "disable_web_page_preview=true" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    2>/dev/null || echo "000"
)"

if [ "$HTTP_CODE" != "200" ]; then
  echo "[alert] Telegram delivery failed (HTTP ${HTTP_CODE})." >&2
fi

exit 0
