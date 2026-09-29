#!/bin/sh
set -eu

if [ -n "${TURSO_DATABASE_URL:-}" ]; then
  export DATABASE_URL="file:/dev/null"
  echo "[entrypoint] Turso mode (adapter handles connection)"
else
  export DATABASE_URL="${DATABASE_URL:-file:/app/data/wf.db}"
  echo "[entrypoint] Local SQLite mode"
fi

echo "[entrypoint] Checking database schema (no destructive flags)..."
if npx prisma db push --skip-generate; then
  echo "[entrypoint] Schema is up to date."
else
  echo "[entrypoint] ERROR: prisma db push failed. Startup stopped to avoid data loss." >&2
  exit 1
fi

echo "[entrypoint] Starting custom server..."
exec node server.mjs
