import { NextRequest, NextResponse } from 'next/server';
import { sendTelegram, getSettings } from '@/lib/telegram/helpers';
import { msgHelp, msgToday, msgTasks, msgUpcoming, msgMailings, msgSummary, msgPersonalTasks } from '@/lib/telegram/messages';
import { db } from '@/lib/db';

interface TgUpdate { update_id: number; message?: { message_id: number; chat: { id: number }; text?: string; from?: { id: number; username?: string; first_name?: string } }; }

export async function POST(req: NextRequest) {
  try {
    const settings = await getSettings();
    if (!settings.telegramBotToken) return NextResponse.json({ ok: false });
    if (settings.telegramEnabled !== 'true') return NextResponse.json({ ok: true });

    const update: TgUpdate = await req.json();
    const msg = update.message;
    if (!msg?.text) return NextResponse.json({ ok: true });

    const chatId = String(msg.chat.id);
    const text = msg.text.trim();
    const command = text.split(' ')[0].toLowerCase();

    if (command === '/start') {
      await sendTelegram(chatId, `📡 <b>WebinarFlow Bot</b>\n\nНапишите <b>/help</b> \u0434ля \u0441\u043f\u0438\u0441\u043a\u0430 \u043a\u043e\u043c\u0430\u043d\u0434.`);
      return NextResponse.json({ ok: true });
    }

    // Bind code
    if (!text.startsWith('/') && /^[A-Za-z0-9]{5,8}$/.test(text)) {
      const code = text.toUpperCase();
      const bindSetting = await db.settings.findUnique({ where: { key: `bind_code_${code}` } });
      if (bindSetting) {
        const responsible = await db.responsible.findUnique({ where: { id: bindSetting.value }, select: { name: true } });
        if (responsible) {
          await db.responsible.update({ where: { id: bindSetting.value }, data: { telegram: chatId } });
          await db.settings.delete({ where: { key: bindSetting.key } });
          await sendTelegram(chatId, `✅ Привязка \u0443\u0441\u043f\u0435\u0448\u043d\u0430!\n\nВ\u044b \u043f\u0440\u0438\u0432\u044f\u0437\u0430\u043d\u044b \u043a\u0430\u043a: <b>${responsible.name}</b>\n\nН\u0430\u043f\u0438\u0448\u0438\u0442\u0435 /today \u0434\u043b\u044f \u043f\u0440\u043e\u0432\u0435\u0440\u043a\u0438.`);
        } else {
          await db.settings.delete({ where: { key: bindSetting.key } });
          await sendTelegram(chatId, '\u274c \u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d.');
        }
      } else {
        await sendTelegram(chatId, '\u274c \u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u044b\u0439 \u043a\u043e\u0434. \u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 /help');
      }
      return NextResponse.json({ ok: true });
    }

    let response = '';
    switch (command) {
      case '/help': response = await msgHelp(); break;
      case '/today': {
        const responsible = await db.responsible.findFirst({ where: { telegram: chatId } });
        response = responsible ? await msgPersonalTasks(responsible.id) : await msgToday();
        break;
      }
      case '/tasks': response = await msgTasks(); break;
      case '/upcoming': response = await msgUpcoming(); break;
      case '/mailings': response = await msgMailings(); break;
      case '/summary': response = await msgSummary(); break;
      default: response = '\u2753 \u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043a\u043e\u043c\u0430\u043d\u0434\u0430. \u041d\u0430\u043f\u0438\u0448\u0438\u0442\u0435 /help';
    }
    await sendTelegram(chatId, response);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  const { getSettings } = await import('@/lib/telegram/helpers');
  const settings = await getSettings();
  return NextResponse.json({ configured: !!settings.telegramBotToken, enabled: settings.telegramEnabled === 'true', chatId: settings.telegramChatId || null });
}
