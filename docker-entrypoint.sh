#!/bin/sh
# Entrypoint: apply pending Prisma migrations to the external PostgreSQL, then
# start the Next.js standalone server.
set -e

echo "[entrypoint] Applying database migrations..."
node ./node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] Starting server on port ${PORT:-30001}..."
exec "$@"
