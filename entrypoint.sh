#!/bin/sh
set -e

# Prefer TURSO_DATABASE_URL over any pre-set DATABASE_URL
if [ -n "$TURSO_DATABASE_URL" ]; then
  export DATABASE_URL="${TURSO_DATABASE_URL}?authToken=${TURSO_AUTH_TOKEN}"
  echo "[entrypoint] Using Turso"
else
  export DATABASE_URL="${DATABASE_URL:-file:/app/data/wf.db}"
  echo "[entrypoint] Using local SQLite"
fi

echo "[entrypoint] Starting server..."
exec node server.js
