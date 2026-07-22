#!/bin/sh
# Entrypoint: apply pending Prisma migrations to PostgreSQL, then start server.
set -e

echo "==== Travel Planner starting ===="
echo "[entrypoint] Node version: $(node -v)"

# Make sure the database is reachable before running migrations. This produces
# a clear log line in TrueNAS instead of an opaque prisma error.
if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] FATAL: DATABASE_URL is not set. Stopping."
  exit 1
fi

echo "[entrypoint] Applying database migrations..."
node ./node_modules/prisma/build/index.js migrate deploy
echo "[entrypoint] Migrations applied successfully."

echo "[entrypoint] Starting server on port ${PORT:-30001}..."
exec "$@"
