#!/bin/sh
set -e
echo "[SMS] Running database migrations..."
npx prisma migrate deploy
echo "[SMS] Starting server..."
exec node -r tsconfig-paths/register dist/app.js
