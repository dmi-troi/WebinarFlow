import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createDb(): PrismaClient {
  // Turso: use driver adapter
  if (process.env.TURSO_DATABASE_URL) {
    try {
      // Dynamic import — packages are marked serverExternalPackages
      // so they load from real node_modules at runtime, not bundled
      const { PrismaLibSQL } = require('@prisma/adapter-libsql');
      const { createClient } = require('@libsql/client');
      const libsql = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN || '',
      });
      const adapter = new PrismaLibSQL(libsql);
      console.log('[db] Turso connected via adapter');
      return new PrismaClient({ adapter });
    } catch (e) {
      console.error('[db] Adapter failed, falling back to local:', e);
    }
  }
  // Local SQLite fallback
  console.log('[db] Local SQLite');
  return new PrismaClient({ datasourceUrl: 'file:/app/data/wf.db' });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createDb();
if (!globalForPrisma.prisma) globalForPrisma.prisma = db;
export { PrismaClient };
