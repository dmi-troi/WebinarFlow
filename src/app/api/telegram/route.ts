import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { chatId, message } = await request.json();

  const settings = await db.settings.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;

  const botToken = map.telegramBotToken;
  if (!botToken) {
    return NextResponse.json({ error: 'Telegram bot token не настроен' }, { status: 400 });
  }

  const targetChatId = chatId || map.telegramChatId;
  if (!targetChatId) {
    return NextResponse.json({ error: 'Chat ID не указан' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: message || 'Тестовое сообщение от WebinarFlow',
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    if (!data.ok) return NextResponse.json({ error: data.description }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const settings = await db.settings.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return NextResponse.json({
    configured: !!map.telegramBotToken,
    chatId: map.telegramChatId || null,
  });
}
