#!/bin/sh
set -e

echo "[SMS] Waiting for database to be ready..."
node -e "
  let retries = 0;
  const max = 30;
  const check = async () => {
    while (retries < max) {
      try {
        const { PrismaClient } = require('@prisma/client');
        const p = new PrismaClient();
        await p.\$queryRaw\`SELECT 1\`;
        await p.\$disconnect();
        console.log('[SMS] Database is ready.');
        process.exit(0);
      } catch (e) {
        retries++;
        console.log('[SMS] Database not ready (' + retries + '/' + max + '), retrying in 2s...');
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    console.error('[SMS] ERROR: Database not available after ' + max + ' retries. Aborting.');
    process.exit(1);
  };
  check();
"

echo "[SMS] Running database migrations..."
node node_modules/prisma/build/index.js migrate deploy
echo "[SMS] Migrations complete."

# ── OPTIONAL SEED ──
# Set RUN_SEED=true in your .env before running docker compose up
# to populate demo accounts and sample data.
#
# The seed script has a production guard that checks NODE_ENV.
# We override it to "development" only for this one node process.
# This does NOT affect the Express server — exec below starts a
# completely separate process with the original environment.
if [ "${RUN_SEED}" = "true" ]; then
  echo "[SMS] RUN_SEED=true — seeding database..."
  NODE_ENV=development node dist-seed/prisma/seed.js
  echo "[SMS] Seed complete."
else
  echo "[SMS] Skipping seed (set RUN_SEED=true to seed on next boot)."
fi

echo "[SMS] Starting application server..."
exec node dist/app.js
