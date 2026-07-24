import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const DEFAULT_SETTINGS: Record<string, string> = {
  taskPeriods: JSON.stringify({
    unisender: 3,
    mtsLink: 1,
    reminder: 1,
    eventDay: 0,
  }),
  taskTypeNames: JSON.stringify({
    unisender: 'Юнисендер',
    mtsLink: 'МТС Link',
    reminder: 'Напоминание',
    eventDay: 'День мероприятия',
    general: 'Общая',
  }),
  taskShiftDirection: 'back',
  maxShiftDays: '7',
  autoRecalc: 'true',
};

export async function GET() {
  const settings = await db.settings.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    if (s.key === 'loginPassword') {
      // Never send the actual password to client, only a flag
      map[s.key] = s.value ? '***set***' : '';
    } else {
      map[s.key] = s.value;
    }
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    if (!(key in map)) map[key] = value;
  }
  return NextResponse.json(map);
}

export async function POST(request: Request) {
  const data = await request.json();
  const results = [];
  for (const [key, value] of Object.entries(data)) {
    // Don't overwrite password with null/empty (means "don't change")
    if (key === 'loginPassword' && !value) continue;
    const upserted = await db.settings.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
    results.push(upserted);
  }
  return NextResponse.json(results);
}