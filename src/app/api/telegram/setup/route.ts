import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { setWebhook, deleteWebhook } from '@/lib/telegram/helpers';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';

export const POST = withAuth(async (request: Request) => {
  const body = await request.json().catch(() => ({}));
  if (body.action === 'set-webhook') {
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl : '';
    if (!baseUrl || !/^https:\/\//i.test(baseUrl)) return NextResponse.json({ error: 'Нужен HTTPS baseUrl' }, { status: 400 });
    return NextResponse.json(await setWebhook(`${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`));
  }
  if (body.action === 'delete-webhook') return NextResponse.json({ ok: await deleteWebhook() });
  if (body.action === 'generate-bind-code') {
    const responsibleId = String(body.responsibleId || '');
    if (!responsibleId) return NextResponse.json({ error: 'Укажите responsibleId' }, { status: 400 });
    const responsible = await db.responsible.findUnique({ where: { id: responsibleId }, select: { id: true } });
    if (!responsible) return NextResponse.json({ error: 'Ответственный не найден' }, { status: 404 });
    const code = randomBytes(4).toString('hex').toUpperCase();
    const value = JSON.stringify({ responsibleId, expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() });
    await db.settings.upsert({ where: { key: `bind_code_${code}` }, update: { value }, create: { key: `bind_code_${code}`, value } });
    return NextResponse.json({ code, expiresInMinutes: 15 });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
});
