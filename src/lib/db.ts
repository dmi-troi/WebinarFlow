// db.ts — Database client
// At RUNTIME: PrismaClient is created by server.mjs and stored on globalThis.__db
// At BUILD TIME: falls back to local SQLite (server.mjs is not running)

import type { PrismaClient as PrismaClientType } from '@prisma/client';

let _db: PrismaClientType | undefined = (globalThis as any).__db;

if (!_db) {
  // Build time or direct require without server.mjs — create local client
  // At runtime this branch is skipped because server.mjs already set globalThis.__db
  const { PrismaClient } = require('@prisma/client');
  _db = new PrismaClient({ datasourceUrl: 'file:/app/data/wf.db' });
  console.log('[db] Fallback: local SQLite (no server.mjs)');
}

export const db = _db;
export type { PrismaClientType as PrismaClient };
