// server.mjs — Custom Next.js server
// This file is NOT processed by Turbopack/webpack.
// All imports use real Node.js module resolution.
// Database connection is created HERE, before any Next.js code loads.

import { createServer } from 'http';
import { parse } from 'url';

async function main() {
  const port = parseInt(process.env.PORT || '3000');
  const hostname = process.env.HOSTNAME || '0.0.0.0';

  // === DATABASE SETUP (before Next.js) ===
  const { PrismaClient } = await import('@prisma/client');
  let prisma;

  if (process.env.TURSO_DATABASE_URL) {
    const { PrismaLibSQL } = await import('@prisma/adapter-libsql');
    const { createClient } = await import('@libsql/client');

    const libsql = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN || '',
    });
    const adapter = new PrismaLibSQL(libsql);
    prisma = new PrismaClient({ adapter });
    console.log('[server] Turso connected via adapter, url:', process.env.TURSO_DATABASE_URL);
  } else {
    prisma = new PrismaClient({ datasourceUrl: 'file:/app/data/wf.db' });
    console.log('[server] Local SQLite');
  }

  // Store on globalThis — db.ts reads from here
  globalThis.__db = prisma;

  // === START NEXT.JS ===
  const next = (await import('next')).default;
  const app = next({ dev: false, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('[server] Error handling request:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}

main().catch((err) => {
  console.error('[server] Fatal:', err);
  process.exit(1);
});
