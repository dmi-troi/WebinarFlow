import { NextRequest, NextResponse } from 'next/server';
import { sendTelegram, getSettings } from '@/lib/telegram/helpers';
import { db } from '@/lib/db';

interface TgUpdate { update_id: number; message?: { message_id: number; chat: { id: number }; text?: string; from?: { id: number; username?: string; first_name?: string } } }

async function getMessageHandlers() {
  const { msgHelp, msgToday, msgTasks, msgUpcoming, msgSummary, msgPersonalTasks } = await import('@/lib/telegram/messages');
  return { msgHelp, msgToday, msgTasks, msgUpcoming, msgSummary, msgPersonalTasks };
}

export async function POST(req: NextRequest) {
  try {
    const settings = await getSettings();
    if (!settings.telegramBotToken) return NextResponse.json({ ok: true });
    if (settings.telegramEnabled !== 'true') return NextResponse.json({ ok: true });

    const secret = settings.telegramWebhookSecret;
    if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const update: TgUpdate = await req.json();
    const msg = update.message;
    if (!msg?.text) return NextResponse.json({ ok: true });
    const chatId = String(msg.chat.id);
    const rawText = msg.text.trim();
    const command = rawText.split(' ')[0].toLowerCase();

    if (command === '/start') {
      await sendTelegram(chatId, '📡 <b>WebinarFlow Bot</b>\n\nНапишите <b>/help</b> для списка команд.');
      return NextResponse.json({ ok: true });
    }

    if (!rawText.startsWith('/') && /^[A-Za-z0-9]{6,8}$/.test(rawText)) {
      const code = rawText.toUpperCase();
      const bindSetting = await db.settings.findUnique({ where: { key: `bind_code_${code}` } });
      if (!bindSetting) {
        await sendTelegram(chatId, '❌ Неизвестный код. Попросите создать новый код в WebinarFlow.');
        return NextResponse.json({ ok: true });
      }
      let responsibleId = bindSetting.value;
      let expiresAt = 0;
      try {
        const parsed = JSON.parse(bindSetting.value);
        responsibleId = String(parsed.responsibleId || '');
        expiresAt = new Date(parsed.expiresAt).getTime();
      } catch { /* old bind codes stored only the ID */ }
      if (expiresAt && expiresAt < Date.now()) {
        await db.settings.delete({ where: { key: bindSetting.key } });
        await sendTelegram(chatId, '❌ Срок действия кода истёк. Создайте новый код в WebinarFlow.');
        return NextResponse.json({ ok: true });
      }
      const responsible = await db.responsible.findUnique({ where: { id: responsibleId }, select: { name: true } });
      if (!responsible) {
        await db.settings.delete({ where: { key: bindSetting.key } });
        await sendTelegram(chatId, '❌ Ответственный не найден.');
        return NextResponse.json({ ok: true });
      }
      await db.$transaction([
        db.responsible.update({ where: { id: responsibleId }, data: { telegram: chatId } }),
        db.settings.delete({ where: { key: bindSetting.key } }),
      ]);
      await sendTelegram(chatId, `✅ Привязка успешна!\n\nВы привязаны как: <b>${responsible.name}</b>\n\nНапишите /today для проверки.`);
      return NextResponse.json({ ok: true });
    }

    const { msgHelp, msgToday, msgTasks, msgUpcoming, msgSummary, msgPersonalTasks } = await getMessageHandlers();
    let response = '';
    switch (command) {
      case '/help': response = await msgHelp(); break;
      case '/today': {
        const responsible = await db.responsible.findFirst({ where: { telegram: chatId } });
        response = responsible ? await msgPersonalTasks(responsible.id) : await msgToday(); break;
      }
      case '/tasks': response = await msgTasks(); break;
      case '/upcoming': response = await msgUpcoming(); break;
      case '/summary': response = await msgSummary(); break;
      default: response = '❓ Неизвестная команда. Напишите /help';
    }
    await sendTelegram(chatId, response);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET(req: NextRequest) {
  const { requireAuth } = await import('@/lib/auth');
  const denied = await requireAuth(req);
  if (denied) return denied;
  const settings = await getSettings();
  const token = settings.telegramBotToken;
  if (!token) return NextResponse.json({ error: 'Токен не задан' }, { status: 400 });
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    return NextResponse.json(await res.json());
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 }); }
}

