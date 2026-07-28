#!/bin/sh
set -e

if [ -n "$TURSO_DATABASE_URL" ]; then
  export DATABASE_URL="file:/dev/null"
  echo "[entrypoint] Turso mode (adapter handles connection)"
else
  export DATABASE_URL="${DATABASE_URL:-file:/app/data/wf.db}"
  echo "[entrypoint] Local SQLite mode"
fi

echo "[entrypoint] Starting server..."
exec npx next start -p "${PORT:-3000}" -H "${HOSTNAME:-0.0.0.0}"
