import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import { hashPassword } from '@/lib/auth';
import { NextResponse } from 'next/server';

const DEFAULT_SETTINGS: Record<string, string> = {
  taskPeriods: JSON.stringify({ unisender: 3, mtsLink: 1, reminder: 1, eventDay: 0, sms: 0 }),
  taskTypeNames: JSON.stringify({ unisender: 'Юнисендер', mtsLink: 'МТС Link', reminder: 'Напоминание', eventDay: 'День мероприятия', sms: 'SMS', general: 'Общая' }),
  taskShiftDirection: 'back',
  maxShiftDays: '7',
  autoRecalc: 'true',
  emailEnabled: 'false',
};

export const GET = withAuth(async (request: Request) => {
  const url = new URL(request.url);
  const reveal = url.searchParams.get('reveal');
  const settings = await db.settings.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) {
    if (s.key === 'loginPassword' || s.key === 'authSessionHash') continue;
    if (s.key === 'telegramBotToken' || s.key === 'mtsLinkApiKey' || s.key === 'telegramWebhookSecret' || s.key === 'cronSecret') continue;
    map[s.key] = s.value;
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) if (!(key in map)) map[key] = value;

  const secretRows = await db.settings.findMany({ where: { key: { in: ['telegramBotToken', 'mtsLinkApiKey', 'telegramWebhookSecret', 'cronSecret', 'loginPassword'] } } });
  for (const row of secretRows) map[`${row.key}Set`] = row.value ? 'true' : 'false';

  if (reveal === 'cronSecret') {
    const row = await db.settings.findUnique({ where: { key: 'cronSecret' } });
    map.cronSecret = row?.value || '';
  }

  try {
    const periods = JSON.parse(map.taskPeriods);
    if (!('sms' in periods)) periods.sms = 0;
    map.taskPeriods = JSON.stringify(periods);
  } catch {}
  try {
    const names = JSON.parse(map.taskTypeNames);
    if (!('sms' in names)) names.sms = 'SMS';
    map.taskTypeNames = JSON.stringify(names);
  } catch {}
  return NextResponse.json(map, { headers: { 'Cache-Control': 'no-store' } });
});

export const POST = withAuth(async (request: Request) => {
  const data = await request.json().catch(() => ({}));

  if (data.action === 'generateCronSecret') {
    const secret = randomBytes(32).toString('hex');
    await db.settings.upsert({ where: { key: 'cronSecret' }, update: { value: secret }, create: { key: 'cronSecret', value: secret } });
    return NextResponse.json({ success: true, cronSecret: secret });
  }

  const allowed = new Set([
    'taskPeriods', 'taskTypeNames', 'taskShiftDirection', 'maxShiftDays', 'autoRecalc', 'emailEnabled',
    'telegramChatId', 'telegramEnabled', 'mtsLinkBaseUrl', 'brandingLogo',
  ]);
  const updates: Promise<unknown>[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key === 'loginPassword') {
      if (typeof value === 'string' && value.trim()) {
        const hashed = hashPassword(value);
        updates.push(db.settings.upsert({ where: { key }, update: { value: hashed }, create: { key, value: hashed } }));
      }
      continue;
    }
    if (['telegramBotToken', 'mtsLinkApiKey'].includes(key)) {
      // Secrets are write-only from the browser: an empty field never erases the saved secret.
      if (typeof value === 'string' && value.trim()) {
        updates.push(db.settings.upsert({ where: { key }, update: { value: value.trim() }, create: { key, value: value.trim() } }));
      }
      continue;
    }
    if (key === 'brandingLogo') {
      if (typeof value !== 'string' || value.length > 900_000 || (!value.startsWith('data:image/webp;base64,') && value !== '')) {
        return NextResponse.json({ error: 'Логотип имеет неверный формат или слишком большой размер' }, { status: 400 });
      }
    }
    if (allowed.has(key)) {
      updates.push(db.settings.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } }));
    }
  }
  await Promise.all(updates);
  return NextResponse.json({ success: true });
});
