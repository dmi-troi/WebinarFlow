import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/health — для внешнего мониторинга (cron-job.org, UptimeRobot и т.п.).
// Не требует авторизации (см. src/middleware.ts PUBLIC_PATHS) и не трогает
// бизнес-логику/внешние API — только сам процесс и доступность БД.
export async function GET() {
  const started = Date.now();
  try {
    await db.settings.findFirst({ select: { id: true } });
    return NextResponse.json({
      status: 'ok',
      db: 'ok',
      responseTimeMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { status: 'error', db: 'error', error: e.message, timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
