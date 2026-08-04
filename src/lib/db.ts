import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || ''

  // Если DATABASE_URL — это Turso (libsql:// или https://),
  // используем адаптер, а для валидации схемы подменяем на file:
  if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('https://')) {
    // Prisma требует file: для provider="sqlite" — подменяем перед созданием клиента
    process.env.DATABASE_URL = 'file:local.db'
    const libsql = createClient({ url: dbUrl })
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
