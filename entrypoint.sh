#!/bin/sh
set -e

# Build DATABASE_URL from TURSO_* vars if DATABASE_URL is not set
if [ -z "$DATABASE_URL" ] && [ -n "$TURSO_DATABASE_URL" ]; then
  export DATABASE_URL="${TURSO_DATABASE_URL}?authToken=${TURSO_AUTH_TOKEN}"
  echo "[entrypoint] Built DATABASE_URL from TURSO_DATABASE_URL + TURSO_AUTH_TOKEN"
fi

# If DATABASE_URL points to Turso, push schema to create/update tables
case "$DATABASE_URL" in
  libsql://*|https://*)
    echo "[entrypoint] Detected Turso URL, running prisma db push..."
    npx prisma db push --accept-data-loss 2>&1 || echo "[entrypoint] prisma db push warning"
    ;;
  *)
    echo "[entrypoint] Using local SQLite, skipping schema push"
    ;;
esac

echo "[entrypoint] Starting server..."
exec node server.js
