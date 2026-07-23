# Multi-stage Dockerfile for the Travel Planner Next.js standalone app.
# Stage 1: deps     - install all dependencies (cached layer).
# Stage 2: builder  - generate Prisma client and build Next.js standalone.
# Stage 3: runner   - minimal runtime image with the standalone server.

# ---- deps ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Prisma client must be generated before the Next.js build uses it.
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=30001
# Force the container timezone to Asia/Kuala_Lumpur (+08:00). Date handling in
# the app (atLocalMidnight / date keys) depends on the process TZ; Docker does
# NOT inherit the host TZ, so without this the container runs in UTC and
# calendar days shift by one vs a +08:00 client (the Tue->Mon bug).
ENV TZ=Asia/Kuala_Lumpur

# Prisma's native engines (Rust binaries) require libssl and the glibc-compat
# shims on Alpine (musl). tzdata backs the TZ env above on Alpine.
RUN apk add --no-cache openssl libc6-compat tzdata

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the standalone server output, static assets, public folder, the Prisma
# migrations (needed by migrate deploy) and the full prisma package (CLI +
# client) so `npx prisma migrate deploy` works at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

USER nextjs
EXPOSE 30001
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
