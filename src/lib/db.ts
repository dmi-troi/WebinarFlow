// db.ts — Database client
// The actual PrismaClient instance is created by server.mjs (custom server)
// and stored on globalThis.__db BEFORE any route code runs.
// This avoids ALL Turbopack/webpack bundling issues with native @libsql/client.

import type { PrismaClient as PrismaClientType } from '@prisma/client';

const db = (globalThis as any).__db as PrismaClientType;

if (!db) {
  throw new Error(
    '[db] Database client not initialized. server.mjs must run first.'
  );
}

export { db };
export type { PrismaClientType as PrismaClient };
