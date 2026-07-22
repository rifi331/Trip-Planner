import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient instance.
 *
 * In development, Next.js hot-reloading can create many PrismaClient instances
 * which quickly exhausts the database connection pool. We stash the instance on
 * the global object so it is reused across hot reloads.
 *
 * In production a single instance is created per process, which is the intended
 * behavior for a long-running Next.js standalone server.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
