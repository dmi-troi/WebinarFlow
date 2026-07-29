import path from 'node:path';
import { defineConfig } from 'prisma/config';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

// Lets the Prisma CLI (`prisma db push`) connect through the same
// libSQL driver adapter the app uses at runtime (see server.mjs).
// Without this, `prisma db push` only knows how to write to a local
// `file:` SQLite database and can't reach a remote Turso database.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  experimental: { adapter: true },
  engine: 'js',
  async adapter() {
    if (process.env.TURSO_DATABASE_URL) {
      return new PrismaLibSQL({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN || '',
      });
    }
    return new PrismaLibSQL({
      url: process.env.DATABASE_URL || 'file:/app/data/wf.db',
    });
  },
});
