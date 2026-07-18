#!/bin/sh
set -e

# ── WAIT FOR DATABASE ──
# Prisma migrate deploy will crash if PostgreSQL isn't accepting connections.
# This loop uses Prisma's own client to poll until the DB is ready,
# with a 60-second timeout (30 retries × 2 seconds).
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
    console.error('[SMS] ERROR: Database not available after ' + max + ' retries (60s). Aborting.');
    process.exit(1);
  };
  check();
"

echo "[SMS] Running database migrations..."
npx prisma migrate deploy
echo "[SMS] Starting server..."
exec node dist/app.js
