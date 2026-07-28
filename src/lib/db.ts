import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createDb(): PrismaClient {
  if (process.env.TURSO_DATABASE_URL) {
    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN || '',
    });
    const adapter = new PrismaLibSQL(libsql);
    console.log('[db] Turso connected via adapter, url:', process.env.TURSO_DATABASE_URL);
    return new PrismaClient({ adapter });
  }
  console.log('[db] Local SQLite');
  return new PrismaClient({ datasourceUrl: 'file:/app/data/wf.db' });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createDb();
if (!globalForPrisma.prisma) globalForPrisma.prisma = db;
export { PrismaClient };
