# Monitoring and Alerting

Alerts go to Telegram. The channel is deliberately simple: no SMTP
dependency (mail is unconfigured), instant push to a phone, and a plain
`curl` call that works from a shell script.

## What sends alerts

| Source | Trigger |
| --- | --- |
| `jocomfy-monitor.timer` | Every 10 minutes: health, disk, containers, failed units, TLS expiry, backup freshness |
| `jocomfy-backup.service` | Failure (via `OnFailure=`), and success summary |
| `jocomfy-backup-verify.service` | Failure, and confirmation that the weekly restore test passed |
| Any unit | Add `OnFailure=jocomfy-alert@%n.service` |

## Setup

### 1. Create the bot

Message `@BotFather` on Telegram, send `/newbot`, follow the prompts, keep
the token. Then message your new bot once (a bot cannot start a
conversation), and read your chat id:

```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" | grep -o '"id":[0-9-]*' | head -1
```

### 2. Store the credentials outside the repository

```bash
install -d -m 700 /etc/jocomfy-alert
cat > /etc/jocomfy-alert/alert.env <<'ENV'
TELEGRAM_BOT_TOKEN=replace_me
TELEGRAM_CHAT_ID=replace_me
ALERT_HOSTNAME=production
ALERT_ENABLED=true
ENV
chmod 600 /etc/jocomfy-alert/alert.env
```

### 3. Test before installing units

```bash
cd /root/school-management-system
scripts/alert.sh OK "Alerting installed" "This is a test notification."
```

A message should arrive within a couple of seconds.

### 4. Install the units

```bash
cd /root/school-management-system
install -m 644 deploy/systemd/jocomfy-alert@.service /etc/systemd/system/
install -m 644 deploy/systemd/jocomfy-monitor.service /etc/systemd/system/
install -m 644 deploy/systemd/jocomfy-monitor.timer   /etc/systemd/system/
install -m 644 deploy/systemd/jocomfy-backup.service  /etc/systemd/system/
install -m 644 deploy/systemd/jocomfy-backup-verify.service /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now jocomfy-monitor.timer
systemctl list-timers 'jocomfy-*'
```

### 5. First run

```bash
systemctl start jocomfy-monitor.service
journalctl -u jocomfy-monitor.service --no-pager --lines=40
```

Every check prints `ok:` or `FAIL:`. The unit exits 0 even when checks
fail — the alert is the signal, not the exit status.

## Design decisions

**Alerts fire on state change, not every run.** State lives in
`/var/lib/jocomfy-monitor`. A problem alerts once when it appears and once
more when it clears. A 10-minute timer would otherwise produce 144 messages
a day for one broken container.

**No PII, ever.** Telegram is a third party. Alerts carry unit names, exit
codes, counters, and thresholds. Never student, guardian, or employee data.
Scripts that could emit row-level output must redirect it away from stdout,
because the failure handler attaches a short journal tail.

**Alert failures never cascade.** `alert.sh` always exits 0. A Telegram
outage must not mark a successful backup as failed.

**Backup freshness is checked directly.** A timer that silently stops
producing files raises no error anywhere — the backups simply stop. The
monitor alerts when the newest dump is older than
`MONITOR_BACKUP_MAX_AGE_HOURS` (default 30).

## Dead-man's switch

Telegram alerting cannot tell you the server is *gone*. If the host is off,
nothing sends, and silence looks exactly like health.

Register a free check at healthchecks.io (or similar), then add its ping URL:

```bash
echo 'MONITOR_HEARTBEAT_URL=https://hc-ping.com/your-uuid' >> /etc/jocomfy-alert/alert.env
```

The monitor pings it only after a fully clean run. If pings stop — dead
host, dead network, dead timer — the external service notifies you.

Note: `monitor.sh` reads `MONITOR_HEARTBEAT_URL` from the environment, so
either add it to the alert env file and reference that from the unit, or
set it with a systemd drop-in:

```bash
systemctl edit jocomfy-monitor.service
# [Service]
# Environment=MONITOR_HEARTBEAT_URL=https://hc-ping.com/your-uuid
```

## Tuning

Defaults are overridable by environment variable:

| Variable | Default | Meaning |
| --- | --- | --- |
| `MONITOR_DISK_THRESHOLD` | `85` | Percent used on `/` before alerting |
| `MONITOR_CERT_MIN_DAYS` | `14` | Days before expiry to alert |
| `MONITOR_BACKUP_MAX_AGE_HOURS` | `30` | Staleness threshold for the newest dump |
| `MONITOR_CONTAINERS` | four production containers | Space-separated names |
| `MONITOR_PUBLIC_URLS` | `jocomfy.com`, `sms.jocomfy.com` | Reachability targets |
| `MONITOR_CERT_HOSTS` | `jocomfy.com`, `sms.jocomfy.com` | TLS expiry targets |

## Muting

```bash
sed -i 's/^ALERT_ENABLED=.*/ALERT_ENABLED=false/' /etc/jocomfy-alert/alert.env
```

Checks keep running and keep logging to the journal; only delivery stops.
