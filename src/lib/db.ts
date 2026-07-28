import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createDb(): PrismaClient {
  // Turso: use driver adapter
  if (process.env.TURSO_DATABASE_URL) {
    try {
      const { PrismaLibSQL } = require('@prisma/adapter-libsql');
      const { createClient } = require('@libsql/client');
      const libsql = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN || '',
      });
      const adapter = new PrismaLibSQL(libsql);
      console.log('[db] Turso connected');
      // datasourceUrl with dummy file: prevents Prisma from
      // reading DATABASE_URL env (which may be undefined/invalid)
      return new PrismaClient({
        adapter,
        datasourceUrl: 'file:/tmp/turso-dummy.db',
      });
    } catch (e) {
      console.error('[db] Adapter failed:', e);
    }
  }
  // Local SQLite fallback
  console.log('[db] Local SQLite');
  return new PrismaClient({ datasourceUrl: 'file:/app/data/wf.db' });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createDb();
if (!globalForPrisma.prisma) globalForPrisma.prisma = db;
export { PrismaClient };
