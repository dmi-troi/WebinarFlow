import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDbUrl(): string {
  // Build from two separate env vars
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;
  if (tursoUrl) {
    const url = new URL(tursoUrl);
    if (tursoToken) url.searchParams.set('authToken', tursoToken);
    return url.toString();
  }
  // Full DATABASE_URL or local fallback
  return process.env.DATABASE_URL || 'file:/app/data/wf.db';
}

function createDb(): PrismaClient {
  const url = getDbUrl();

  // Turso/libsql remote: use driver adapter
  if (url.startsWith('libsql://') || url.startsWith('https://')) {
    try {
      const { PrismaLibSQL } = require('@prisma/adapter-libsql');
      const { createClient } = require('@libsql/client');

      const libsqlUrl = process.env.TURSO_DATABASE_URL || url;
      const authToken = process.env.TURSO_AUTH_TOKEN || '';

      const libsql = createClient({ url: libsqlUrl, authToken });
      const adapter = new PrismaLibSQL(libsql);

      console.log('[db] Using Turso via driver adapter');
      return new PrismaClient({ adapter });
    } catch (e) {
      console.error('[db] Failed to load libsql adapter, falling back to SQLite:', e);
    }
  }

  // Local SQLite
  console.log('[db] Using local SQLite');
  return new PrismaClient({ datasourceUrl: url });
}

// Ensure local DB directory exists
try {
  const fs = require('fs');
  const url = getDbUrl();
  if (url.startsWith('file:')) {
    const dir = url.replace('file:', '').replace(/[^/]*$/, '');
    if (dir) fs.mkdirSync(dir, { recursive: true });
  }
} catch {}

export const db: PrismaClient = globalForPrisma.prisma ?? createDb();
if (!globalForPrisma.prisma) globalForPrisma.prisma = db;

export { PrismaClient };

export async function initDb() {
  try {
    await db.$connect();
  } catch (e) {
    console.error('DB init error:', e);
  }
}
