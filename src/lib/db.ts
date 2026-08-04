import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || ''

  // Если DATABASE_URL — это Turso (libsql:// или https://),
  // используем адаптер, а для валидации схемы подменяем URL через overrideDatasources
  if (dbUrl.startsWith('libsql://') || dbUrl.startsWith('https://')) {
    const libsql = createClient({ url: dbUrl })
    const adapter = new PrismaLibSql(libsql)
    return new PrismaClient({
      adapter,
      overrideDatasources: {
        db: { url: 'file:local.db' },
      },
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
