#!/bin/sh
set -e
echo "[SMS] Running database migrations..."
npx prisma migrate deploy
echo "[SMS] Starting server..."
exec node dist/app.js
