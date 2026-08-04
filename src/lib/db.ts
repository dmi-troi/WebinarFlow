import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // TURSO_URL — реальный URL Turso (libsql://...)
  // DATABASE_URL — заглушка file:local.db для валидации схемы Prisma
  const tursoUrl = process.env.TURSO_URL

  if (tursoUrl) {
    const libsql = createClient({ url: tursoUrl })
    const adapter = new PrismaLibSql(libsql)
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'production' ? [] : ['query'],
    })
  }

  // Локальная разработка — SQLite файл
  return new PrismaClient({
    log: ['query'],
  })
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
