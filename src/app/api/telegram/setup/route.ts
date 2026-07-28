import { NextRequest, NextResponse } from 'next/server';
import { setWebhook, deleteWebhook } from '@/lib/telegram/helpers';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === 'set-webhook') {
      const baseUrl = body.baseUrl;
      if (!baseUrl) return NextResponse.json({ error: 'Укажите baseUrl' }, { status: 400 });
      const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;
      return NextResponse.json(await setWebhook(webhookUrl));
    }
    if (body.action === 'delete-webhook') {
      await deleteWebhook();
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'generate-bind-code') {
      const { responsibleId } = body;
      if (!responsibleId) return NextResponse.json({ error: 'Укажите responsibleId' }, { status: 400 });
      const code = crypto.randomBytes(3).toString('hex').toUpperCase();
      await db.settings.upsert({ where: { key: `bind_code_${code}` }, update: { value: responsibleId }, create: { key: `bind_code_${code}`, value: responsibleId } });
      return NextResponse.json({ code });
    }
    if (body.action === 'bind-chat') {
      const { responsibleId, chatId } = body;
      if (!responsibleId || !chatId) return NextResponse.json({ error: 'Укажите responsibleId и chatId' }, { status: 400 });
      await db.responsible.update({ where: { id: responsibleId }, data: { telegram: String(chatId) } });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
