#!/bin/sh
set -e

# Don't override DATABASE_URL with libsql:// — the adapter in db.ts
# connects to Turso directly via TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
# Prisma only needs a valid file: URL for schema validation.
if [ -n "$TURSO_DATABASE_URL" ]; then
  export DATABASE_URL="file:/dev/null"
  echo "[entrypoint] Turso mode (adapter handles connection)"
else
  export DATABASE_URL="${DATABASE_URL:-file:/app/data/wf.db}"
  echo "[entrypoint] Local SQLite mode"
fi

echo "[entrypoint] Starting server..."
exec node server.js
