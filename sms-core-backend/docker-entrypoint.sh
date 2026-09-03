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
# When RUN_SEED=true the base seed runs first (org + accounts + sample data),
# then the demo finance-history seed runs to make the finance module look
# lived-in (invoices, collections, expenses, payroll, ledgers, billing).
# Both scripts are destructive and refuse a non-empty database unless
# FORCE=true. FORCE_SEED=true is intentionally separate from RUN_SEED=true so
# accidental restarts cannot erase existing school records.
# NODE_ENV is overridden only for the seed processes; the Express server keeps
# its original environment.
if [ "${RUN_SEED}" = "true" ]; then
  echo "[SMS] RUN_SEED=true — running destructive-seed safety checks..."
  FORCE="${FORCE_SEED:-false}" NODE_ENV=development node dist-seed/prisma/seed.js
  echo "[SMS] Base seed complete."

  if [ -f dist-seed/prisma/demo-finance-seed.js ]; then
    echo "[SMS] Running demo finance-history seed..."
    FORCE="${FORCE_SEED:-false}" NODE_ENV=development node dist-seed/prisma/demo-finance-seed.js
    echo "[SMS] Demo finance seed complete."
  else
    echo "[SMS] demo-finance-seed not present in image; skipping finance seed."
  fi

  echo "[SMS] Seed complete."
else
  echo "[SMS] Skipping seed (set RUN_SEED=true to seed on next boot)."
fi

echo "[SMS] Starting application server..."
exec node dist/app.js
