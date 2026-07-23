#!/bin/sh
# Entrypoint: validate config, test DB reachability, apply migrations, start.
set -e

echo "==== Travel Planner starting ===="
echo "[entrypoint] Node version: $(node -v)"
echo "[entrypoint] App version: 0.2.2"
echo "[entrypoint] Timezone: $(date +%Z) ($(date +%z))"

if [ -z "$DATABASE_URL" ]; then
  echo "[entrypoint] FATAL: DATABASE_URL is not set. Stopping."
  exit 1
fi
if [ -z "$OPENAI_API_KEY" ]; then
  echo "[entrypoint] WARNING: OPENAI_API_KEY is not set - AI generation will fail."
fi

# Probe DB reachability so failures show a human-readable reason in the logs
# instead of an opaque Prisma stack trace.
node -e '
  const net = require("net");
  const u = process.env.DATABASE_URL;
  const m = u.match(/@([^:/?#]+)(?::(\d+))?/);
  if (!m) { console.error("[db-probe] Could not parse host from DATABASE_URL"); process.exit(1); }
  const host = m[1];
  const port = m[2] ? Number(m[2]) : 5432;
  const sock = net.connect({ host, port, timeout: 5000 });
  sock.on("connect", () => { console.log("[db-probe] Reached " + host + ":" + port); sock.end(); });
  sock.on("timeout", () => { console.error("[db-probe] TIMEOUT reaching " + host + ":" + port); sock.destroy(); process.exit(1); });
  sock.on("error", (e) => { console.error("[db-probe] FAILED reaching " + host + ":" + port + " -> " + e.message); process.exit(1); });
'

echo "[entrypoint] Applying database migrations..."
# Call the prisma CLI directly via its absolute path. The standalone Next.js
# build does not create node_modules/.bin, so `npx prisma` fails with
# "prisma: not found" on Alpine. We copied node_modules/prisma into the image,
# so the CLI entry (build/index.js) is available by path.
node ./node_modules/prisma/build/index.js migrate deploy
echo "[entrypoint] Migrations applied successfully."

echo "[entrypoint] Starting server on port ${PORT:-30001}..."
exec "$@"
