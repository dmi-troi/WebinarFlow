#!/bin/sh
set -e

# Always prefer TURSO_DATABASE_URL over any pre-set DATABASE_URL
if [ -n "$TURSO_DATABASE_URL" ]; then
  export DATABASE_URL="${TURSO_DATABASE_URL}?authToken=${TURSO_AUTH_TOKEN}"
  echo "[entrypoint] Using Turso: ${TURSO_DATABASE_URL}"
else
  # Local SQLite fallback
  export DATABASE_URL="${DATABASE_URL:-file:/app/data/wf.db}"
  echo "[entrypoint] Using local SQLite: ${DATABASE_URL}"
fi

# Push schema to Turso on cold start (with 30s timeout to avoid hanging)
case "$DATABASE_URL" in
  libsql://*|https://*)
    echo "[entrypoint] Running prisma db push..."
    timeout 30 npx prisma db push --accept-data-loss 2>&1 || echo "[entrypoint] prisma db push skipped or failed (non-fatal)"
    ;;
  *)
    echo "[entrypoint] Local SQLite, skipping schema push"
    ;;
esac

echo "[entrypoint] Starting server on port ${PORT:-3000}..."
exec node server.js
