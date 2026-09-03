import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const DEFAULT_SETTINGS: Record<string, string> = {
  taskPeriods: JSON.stringify({
    unisender: 3,
    mtsLink: 1,
    reminder: 1,
    eventDay: 0,
    sms: 0,
  }),
  taskTypeNames: JSON.stringify({
    unisender: 'Юнисендер',
    mtsLink: 'МТС Link',
    reminder: 'Напоминание',
    eventDay: 'День мероприятия',
    sms: 'SMS',
    general: 'Общая',
  }),
  taskShiftDirection: 'back',
  maxShiftDays: '7',
  autoRecalc: 'true',
  emailEnabled: 'false',
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

  // Мягкая миграция: если у существующего пользователя taskPeriods/taskTypeNames
  // уже сохранены в БД (без ключа 'sms'), добавляем его, не трогая остальное.
  try {
    const periods = JSON.parse(map.taskPeriods);
    if (!('sms' in periods)) {
      periods.sms = 0;
      map.taskPeriods = JSON.stringify(periods);
    }
  } catch { /* ignore malformed JSON */ }
  try {
    const names = JSON.parse(map.taskTypeNames);
    if (!('sms' in names)) {
      names.sms = 'SMS';
      map.taskTypeNames = JSON.stringify(names);
    }
  } catch { /* ignore malformed JSON */ }

  return NextResponse.json(map);
}

export async function POST(request: Request) {
  const data = await request.json();
  const results: Record<string, string>[] = [];
  for (const [key, value] of Object.entries(data)) {
    // Don't overwrite password with null/empty (means "don't change")
    if (key === 'loginPassword' && !value) continue;
    const upserted = await db.settings.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
    results.push(upserted as unknown as Record<string, string>);
  }
  return NextResponse.json(results);
}