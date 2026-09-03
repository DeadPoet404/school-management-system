#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${1:-/etc/jocomfy-demo/demo.env}"
# The DEMO Supabase project ref — you set this to your actual project ref.
# IMPORTANT: this must NEVER equal the prod or staging project ref.
EXPECTED_PROJECT_REF="${EXPECTED_DEMO_PROJECT_REF:-bgrmomfudlozpkdmlpdn}"
EXPECTED_HOST="aws-1-eu-west-1.pooler.supabase.com"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: Demo environment file not found: $ENV_FILE" >&2
  exit 1
fi

MODE="$(stat -c '%a' "$ENV_FILE")"
if [ "$MODE" != "600" ]; then
  echo "ERROR: $ENV_FILE must have permission mode 600; found $MODE." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required_values=(
  DATABASE_URL
  DIRECT_URL
  JWT_SECRET
  JWT_REFRESH_SECRET
  COOKIE_SECRET
  CORS_ORIGINS
)

for variable in "${required_values[@]}"; do
  if [ -z "${!variable:-}" ]; then
    echo "ERROR: Required demo value is empty: $variable" >&2
    exit 1
  fi
done

# The demo MUST point at the demo project only.
if [[ "$DATABASE_URL" != *"postgres.${EXPECTED_PROJECT_REF}:"* ]]; then
  echo "ERROR: DATABASE_URL does not use the expected demo project." >&2
  exit 1
fi
if [[ "$DATABASE_URL" != *"${EXPECTED_HOST}:6543/"* ]]; then
  echo "ERROR: DATABASE_URL is not using the demo transaction pooler." >&2
  exit 1
fi
if [[ "$DIRECT_URL" != *"postgres.${EXPECTED_PROJECT_REF}:"* ]]; then
  echo "ERROR: DIRECT_URL does not use the expected demo project." >&2
  exit 1
fi
if [[ "$DIRECT_URL" != *"${EXPECTED_HOST}:5432/"* ]]; then
  echo "ERROR: DIRECT_URL is not using the demo session pooler." >&2
  exit 1
fi

if [ "$DATABASE_URL" = "$DIRECT_URL" ]; then
  echo "ERROR: Runtime and migration URLs must use different pooler ports." >&2
  exit 1
fi

if [ "$JWT_SECRET" = "$JWT_REFRESH_SECRET" ]; then
  echo "ERROR: JWT secrets must be different." >&2
  exit 1
fi

if [ "${#JWT_SECRET}" -lt 32 ] ||
   [ "${#JWT_REFRESH_SECRET}" -lt 32 ] ||
   [ "${#COOKIE_SECRET}" -lt 32 ]; then
  echo "ERROR: Demo secrets must contain at least 32 characters." >&2
  exit 1
fi

if [ "${COOKIE_SECURE:-}" != "true" ]; then
  echo "ERROR: Demo cookies must be Secure." >&2
  exit 1
fi

# The seeder must stay OFF after the one-time seed so restarts never wipe data.
if [ "${RUN_SEED:-}" != "false" ]; then
  echo "ERROR: RUN_SEED must remain false after the one-time demo seed." >&2
  exit 1
fi

if [[ "$CORS_ORIGINS" != *"https://sms-demo.jocomfy.com"* ]]; then
  echo "ERROR: Demo CORS origins are incomplete." >&2
  exit 1
fi

# Demo must never have real integrations (same rule as staging).
disabled_integrations=(
  PAYSTACK_SECRET_KEY
  PAYSTACK_CALLBACK_URL
  GOOGLE_CLIENT_ID
  ARKESEL_API_KEY
  ARKESEL_SENDER_ID
  META_WA_PHONE_NUMBER_ID
  META_WA_ACCESS_TOKEN
  GMAIL_USER
  GMAIL_APP_PASSWORD
)

for variable in "${disabled_integrations[@]}"; do
  if [ -n "${!variable:-}" ]; then
    echo "ERROR: Live integration must be disabled in demo: $variable" >&2
    exit 1
  fi
done

echo "Demo environment validation: PASS"
echo "Project reference: $EXPECTED_PROJECT_REF"
echo "Runtime pooler: $EXPECTED_HOST:6543"
echo "Migration pooler: $EXPECTED_HOST:5432"
echo "External payment and communication integrations: DISABLED"
