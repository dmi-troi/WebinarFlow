import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

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
  } catch {
    // Health endpoint is public for monitoring; never expose DB/network details.
    return NextResponse.json(
      { status: 'error', db: 'error', error: 'Database unavailable', timestamp: new Date().toISOString() },
      { status: 503 },
    );
  }
}
