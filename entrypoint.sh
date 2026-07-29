#!/bin/sh
set -e

if [ -n "$TURSO_DATABASE_URL" ]; then
  # Set a valid file: URL so Prisma schema validation doesn't crash.
  # The adapter in server.mjs handles the real Turso connection.
  export DATABASE_URL="file:/dev/null"
  echo "[entrypoint] Turso mode (adapter handles connection)"
else
  export DATABASE_URL="${DATABASE_URL:-file:/app/data/wf.db}"
  echo "[entrypoint] Local SQLite mode"
fi

echo "[entrypoint] Applying database schema (prisma db push)..."
if npx prisma db push --accept-data-loss --skip-generate; then
  echo "[entrypoint] Schema is up to date."
else
  echo "[entrypoint] WARNING: prisma db push failed — the app may error until this is fixed." >&2
fi

echo "[entrypoint] Starting custom server..."
exec node server.mjs
