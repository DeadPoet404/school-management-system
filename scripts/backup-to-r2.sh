#!/usr/bin/env bash
# Create a portable SMS database backup, encrypt it with age, upload it to
# Cloudflare R2, and verify the encrypted object through a download/checksum.
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RCLONE_BIN="${RCLONE_BIN:-/usr/local/bin/rclone}"
RCLONE_CONFIG="${RCLONE_CONFIG:-/root/.config/rclone/rclone.conf}"
R2_REMOTE="${R2_REMOTE:-r2:jocomfy-production-backups}"
AGE_RECIPIENT_FILE="${AGE_RECIPIENT_FILE:-/etc/jocomfy-backup/age-recipients.txt}"

for command_path in \
  "$RCLONE_BIN" \
  /usr/bin/age \
  /usr/bin/gzip \
  /usr/bin/sha256sum \
  /usr/bin/flock
do
  if [ ! -x "$command_path" ]; then
    echo "ERROR: Required executable is missing: $command_path" >&2
    exit 1
  fi
done

if [ ! -f "$RCLONE_CONFIG" ]; then
  echo "ERROR: Rclone configuration not found: $RCLONE_CONFIG" >&2
  exit 1
fi

if [ ! -s "$AGE_RECIPIENT_FILE" ]; then
  echo "ERROR: Age recipient file not found: $AGE_RECIPIENT_FILE" >&2
  exit 1
fi

exec 9>"$ROOT/backups/.r2-backup.lock"

if ! flock -n 9; then
  echo "ERROR: Another backup operation is already running." >&2
  exit 1
fi

WORK_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT

echo "Creating portable production backup..."

"$ROOT/scripts/backup.sh"

LATEST_BACKUP="$(
  find "$ROOT/backups" \
    -maxdepth 1 \
    -type f \
    -name 'sms_db_*.sql.gz' \
    -printf '%T@ %p\n' |
    sort -nr |
    head -n 1 |
    cut -d' ' -f2-
)"

if [ -z "$LATEST_BACKUP" ] || [ ! -f "$LATEST_BACKUP" ]; then
  echo "ERROR: backup.sh did not produce a backup file." >&2
  exit 1
fi

gzip -t "$LATEST_BACKUP"

BACKUP_NAME="$(basename "$LATEST_BACKUP")"
ENCRYPTED_NAME="${BACKUP_NAME}.age"
ENCRYPTED_FILE="$WORK_DIR/$ENCRYPTED_NAME"
CHECKSUM_FILE="${ENCRYPTED_FILE}.sha256"

echo "Encrypting $BACKUP_NAME..."

age \
  --encrypt \
  --recipients-file "$AGE_RECIPIENT_FILE" \
  --output "$ENCRYPTED_FILE" \
  "$LATEST_BACKUP"

(
  cd "$WORK_DIR"
  sha256sum "$ENCRYPTED_NAME" \
    > "${ENCRYPTED_NAME}.sha256"
)

REMOTE_PREFIX="$R2_REMOTE/daily/$(TZ=Africa/Accra date +%Y/%m)"
REMOTE_ENCRYPTED="$REMOTE_PREFIX/$ENCRYPTED_NAME"
REMOTE_CHECKSUM="${REMOTE_ENCRYPTED}.sha256"

rclone_command() {
  "$RCLONE_BIN" \
    --config "$RCLONE_CONFIG" \
    "$@" \
    --s3-no-check-bucket \
    --retries 5 \
    --low-level-retries 10
}

echo "Uploading encrypted backup to R2..."

rclone_command \
  copyto \
  "$ENCRYPTED_FILE" \
  "$REMOTE_ENCRYPTED"

rclone_command \
  copyto \
  "$CHECKSUM_FILE" \
  "$REMOTE_CHECKSUM"

VERIFY_DIR="$WORK_DIR/verify"
mkdir -p "$VERIFY_DIR"

echo "Downloading encrypted objects for verification..."

rclone_command \
  copyto \
  "$REMOTE_ENCRYPTED" \
  "$VERIFY_DIR/$ENCRYPTED_NAME"

rclone_command \
  copyto \
  "$REMOTE_CHECKSUM" \
  "$VERIFY_DIR/${ENCRYPTED_NAME}.sha256"

(
  cd "$VERIFY_DIR"
  sha256sum -c "${ENCRYPTED_NAME}.sha256"
)

echo
echo "Remote object:"
rclone_command lsl "$REMOTE_ENCRYPTED"

echo
echo "Encrypted R2 backup verification: PASS"
echo "Source backup: $LATEST_BACKUP"
echo "Remote backup: $REMOTE_ENCRYPTED"
