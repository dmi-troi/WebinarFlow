import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const POST = withAuth(async (request: Request) => {
  const { chatId, message } = await request.json().catch(() => ({}));
  const settings = Object.fromEntries((await db.settings.findMany()).map((s) => [s.key, s.value]));
  if (!settings.telegramBotToken) return NextResponse.json({ error: 'Telegram bot token не настроен' }, { status: 400 });
  const targetChatId = chatId || settings.telegramChatId;
  if (!targetChatId) return NextResponse.json({ error: 'Chat ID не указан' }, { status: 400 });
  try {
    const res = await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: targetChatId, text: message || 'Тестовое сообщение от WebinarFlow', parse_mode: 'HTML' }) });
    const data = await res.json();
    if (!data.ok) return NextResponse.json({ error: data.description }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 }); }
});

export const GET = withAuth(async () => {
  const settings = Object.fromEntries((await db.settings.findMany()).map((s) => [s.key, s.value]));
  return NextResponse.json({ configured: !!settings.telegramBotToken, chatId: settings.telegramChatId || null });
});
