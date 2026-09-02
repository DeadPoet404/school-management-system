#!/usr/bin/env bash
# Jocomfy platform monitor — periodic operational checks with Telegram
# alerting on state CHANGE (not on every run, to avoid notification fatigue).
#
# Checks:
#   1. Backend health endpoints (production + staging), incl. db connectivity
#   2. Public site reachability through Cloudflare
#   3. Disk usage against a threshold
#   4. Docker container running/health state
#   5. Failed systemd units
#   6. TLS certificate expiry
#   7. Backup freshness (a backup that stopped running is invisible otherwise)
#
# State is kept in /var/lib/jocomfy-monitor so a problem alerts once when it
# starts and once more when it clears.
#
# Emits only aggregate operational facts. No record-level data.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ALERT="$ROOT/scripts/alert.sh"
STATE_DIR="${MONITOR_STATE_DIR:-/var/lib/jocomfy-monitor}"

DISK_THRESHOLD="${MONITOR_DISK_THRESHOLD:-85}"
CERT_MIN_DAYS="${MONITOR_CERT_MIN_DAYS:-14}"
BACKUP_MAX_AGE_HOURS="${MONITOR_BACKUP_MAX_AGE_HOURS:-30}"

PROD_HEALTH="${MONITOR_PROD_HEALTH:-http://127.0.0.1:5000/api/health}"
STAGING_HEALTH="${MONITOR_STAGING_HEALTH:-http://127.0.0.1:5100/api/health}"
PUBLIC_URLS="${MONITOR_PUBLIC_URLS:-https://jocomfy.com https://sms.jocomfy.com}"
CERT_HOSTS="${MONITOR_CERT_HOSTS:-jocomfy.com sms.jocomfy.com}"
CONTAINERS="${MONITOR_CONTAINERS:-jocomfy-site-caddy-1 jocomfy-site-website-1 school-management-system-frontend-1 school-management-system-backend-1}"

mkdir -p "$STATE_DIR" 2>/dev/null || true

FAILURES=0

# ── State-change helpers ───────────────────────────────────────────────
# Alert when a check transitions OK->BAD or BAD->OK, staying quiet while
# the state is unchanged.
report() {
  local key="$1" status="$2" title="$3"; shift 3
  local state_file="$STATE_DIR/$key"
  local previous="ok"

  [ -f "$state_file" ] && previous="$(cat "$state_file" 2>/dev/null || echo ok)"

  if [ "$status" = "bad" ]; then
    FAILURES=$((FAILURES + 1))
    echo "FAIL: $title"
    if [ "$previous" != "bad" ]; then
      "$ALERT" FAIL "$title" "$@"
    fi
    echo "bad" > "$state_file" 2>/dev/null || true
  else
    echo "ok:   $title"
    if [ "$previous" = "bad" ]; then
      "$ALERT" OK "Recovered: $title" "$@"
    fi
    echo "ok" > "$state_file" 2>/dev/null || true
  fi
}

# ── 1. Backend health ──────────────────────────────────────────────────
check_health() {
  local key="$1" url="$2" label="$3"
  local body http

  body="$(curl -sS --max-time 10 --write-out '\n%{http_code}' "$url" 2>/dev/null || true)"
  http="$(printf '%s' "$body" | tail -n1)"
  body="$(printf '%s' "$body" | sed '$d')"

  if [ "$http" != "200" ]; then
    report "$key" bad "$label backend unhealthy" "endpoint: $url" "http status: ${http:-no response}"
    return
  fi

  case "$body" in
    *'"status":"connected"'*) report "$key" ok "$label backend healthy" ;;
    *) report "$key" bad "$label database not connected" "endpoint: $url" "http status: 200 but db is not reporting connected" ;;
  esac
}

check_health prod-health    "$PROD_HEALTH"    "Production"
check_health staging-health "$STAGING_HEALTH" "Staging"

# ── 2. Public reachability ─────────────────────────────────────────────
for url in $PUBLIC_URLS; do
  key="public-$(printf '%s' "$url" | tr -cd 'a-zA-Z0-9')"
  code="$(curl -sS -o /dev/null --max-time 15 --write-out '%{http_code}' "$url" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ] || [ "$code" = "301" ] || [ "$code" = "302" ] || [ "$code" = "308" ]; then
    report "$key" ok "Public endpoint reachable: $url"
  else
    report "$key" bad "Public endpoint unreachable: $url" "http status: $code"
  fi
done

# ── 3. Disk ────────────────────────────────────────────────────────────
DISK_USED="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [ -n "$DISK_USED" ] && [ "$DISK_USED" -ge "$DISK_THRESHOLD" ]; then
  report disk bad "Disk usage ${DISK_USED}%" "threshold: ${DISK_THRESHOLD}%" "filesystem: /"
else
  report disk ok "Disk usage ${DISK_USED}%"
fi

# ── 4. Containers ──────────────────────────────────────────────────────
for container in $CONTAINERS; do
  key="container-$(printf '%s' "$container" | tr -cd 'a-zA-Z0-9')"
  if ! docker inspect "$container" >/dev/null 2>&1; then
    report "$key" bad "Container missing: $container" "the container does not exist on this host"
    continue
  fi

  running="$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || echo false)"
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo unknown)"
  restarts="$(docker inspect -f '{{.RestartCount}}' "$container" 2>/dev/null || echo 0)"

  if [ "$running" != "true" ]; then
    report "$key" bad "Container not running: $container" "restart count: $restarts"
  elif [ "$health" = "unhealthy" ]; then
    report "$key" bad "Container unhealthy: $container" "restart count: $restarts"
  else
    report "$key" ok "Container up: $container"
  fi
done

# ── 5. Failed systemd units ────────────────────────────────────────────
FAILED_UNITS="$(systemctl list-units --state=failed --no-legend --plain 2>/dev/null | awk '{print $1}' | paste -sd' ' -)"
if [ -n "$FAILED_UNITS" ]; then
  report systemd bad "Failed systemd units present" "units: $FAILED_UNITS"
else
  report systemd ok "No failed systemd units"
fi

# ── 6. TLS expiry ──────────────────────────────────────────────────────
for host in $CERT_HOSTS; do
  key="cert-$(printf '%s' "$host" | tr -cd 'a-zA-Z0-9')"
  end_date="$(echo | timeout 15 openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"

  if [ -z "$end_date" ]; then
    report "$key" bad "Certificate check failed: $host" "could not read the certificate"
    continue
  fi

  end_epoch="$(date -d "$end_date" +%s 2>/dev/null || echo 0)"
  now_epoch="$(date +%s)"
  days_left=$(( (end_epoch - now_epoch) / 86400 ))

  if [ "$end_epoch" -eq 0 ]; then
    report "$key" bad "Certificate date unparseable: $host"
  elif [ "$days_left" -lt "$CERT_MIN_DAYS" ]; then
    report "$key" bad "Certificate expiring: $host" "days remaining: $days_left" "threshold: $CERT_MIN_DAYS days"
  else
    report "$key" ok "Certificate valid: $host (${days_left}d)"
  fi
done

# ── 7. Backup freshness ────────────────────────────────────────────────
# A backup timer that silently stopped is the failure mode alerting exists
# for: nothing errors, the backups simply stop appearing.
LATEST_BACKUP="$(find "$ROOT/backups" -maxdepth 1 -type f -name 'sms_db_*.sql.gz' -printf '%T@ %p\n' 2>/dev/null \
  | sort -nr | head -n1 | cut -d' ' -f2-)"

if [ -z "$LATEST_BACKUP" ]; then
  report backup bad "No database backup found" "expected: backups/sms_db_*.sql.gz"
else
  backup_epoch="$(stat -c %Y "$LATEST_BACKUP" 2>/dev/null || echo 0)"
  age_hours=$(( ( $(date +%s) - backup_epoch ) / 3600 ))
  if [ "$age_hours" -gt "$BACKUP_MAX_AGE_HOURS" ]; then
    report backup bad "Latest backup is stale" "age: ${age_hours}h" "threshold: ${BACKUP_MAX_AGE_HOURS}h"
  else
    report backup ok "Backup fresh (${age_hours}h old)"
  fi
fi

# ── Heartbeat ──────────────────────────────────────────────────────────
# Dead-man's switch: ping an external monitor after a fully clean run. If
# this host dies entirely, the pings stop and the external service alerts.
# Silence from a dead server is otherwise indistinguishable from health.
if [ "$FAILURES" -eq 0 ] && [ -n "${MONITOR_HEARTBEAT_URL:-}" ]; then
  curl -sS --max-time 10 --retry 2 -o /dev/null "$MONITOR_HEARTBEAT_URL" 2>/dev/null || true
fi

echo
echo "Monitor run complete. Failing checks: $FAILURES"
exit 0
