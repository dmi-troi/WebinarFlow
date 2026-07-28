import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getTursoConfig(): { url: string; authToken: string } | null {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (url) return { url, authToken: token || '' };
  return null;
}

function getDatasourceUrl(): string {
  // If TURSO vars exist, build libsql URL for Prisma datasource fallback
  const turso = getTursoConfig();
  if (turso) {
    const u = new URL(turso.url);
    if (turso.authToken) u.searchParams.set('authToken', turso.authToken);
    return u.toString();
  }
  return process.env.DATABASE_URL || 'file:/app/data/wf.db';
}

function createDb(): PrismaClient {
  const turso = getTursoConfig();

  if (turso) {
    try {
      // Use require() — works in Next.js standalone CJS server.
      // These packages are manually copied in Dockerfile.
      const { PrismaLibSQL } = require('@prisma/adapter-libsql');
      const { createClient } = require('@libsql/client');

      const libsql = createClient({
        url: turso.url,
        authToken: turso.authToken,
      });
      const adapter = new PrismaLibSQL(libsql);

      console.log('[db] Connected to Turso via driver adapter');
      return new PrismaClient({ adapter });
    } catch (e) {
      console.error('[db] Adapter failed, using datasource URL directly:', e);
      // Fallback: pass libsql URL as datasourceUrl (Prisma supports this with sqlite provider)
      return new PrismaClient({ datasourceUrl: getDatasourceUrl() });
    }
  }

  // Local SQLite
  console.log('[db] Using local SQLite');
  return new PrismaClient({ datasourceUrl: getDatasourceUrl() });
}

// Ensure local DB directory exists (only for local SQLite)
try {
  const fs = require('fs');
  const url = getDatasourceUrl();
  if (url.startsWith('file:')) {
    const dir = url.replace('file:', '').replace(/[^/]*$/, '');
    if (dir) fs.mkdirSync(dir, { recursive: true });
  }
} catch {}

export const db: PrismaClient = globalForPrisma.prisma ?? createDb();
if (!globalForPrisma.prisma) globalForPrisma.prisma = db;

export { PrismaClient };
