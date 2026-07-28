// db.ts — Database client via Proxy
// 
// RUNTIME: server.mjs creates PrismaClient with Turso adapter and stores it
//   on globalThis.__db BEFORE Next.js loads any route modules.
//   The Proxy delegates all property access to the real client.
//
// BUILD TIME: globalThis.__db is not set, so the Proxy returns undefined
//   for all property access. This lets next build pass without errors.
//   No require/import of @prisma/client at runtime — no bundling issues.

import type { PrismaClient as PrismaClientType } from '@prisma/client';

type DbProxy = PrismaClientType;

export const db = new Proxy({} as DbProxy, {
  get(_target, prop, _receiver) {
    const real = (globalThis as any).__db as PrismaClientType | undefined;
    if (!real) return undefined;
    const value = (real as any)[prop];
    if (typeof value === 'function') return value.bind(real);
    return value;
  },
  has(_target, prop) {
    const real = (globalThis as any).__db;
    return real ? prop in (real as any) : false;
  },
  ownKeys() {
    const real = (globalThis as any).__db;
    return real ? Reflect.ownKeys(real) : [];
  },
  getOwnPropertyDescriptor(_target, prop) {
    const real = (globalThis as any).__db;
    if (!real) return undefined;
    return Reflect.getOwnPropertyDescriptor(real, prop);
  },
});

export type { PrismaClientType as PrismaClient };
