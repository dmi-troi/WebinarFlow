import { NextResponse } from 'next/server';
import { getSettings, sendTelegram } from '@/lib/telegram/helpers';
import { msgSummary, msgPersonalTasks } from '@/lib/telegram/messages';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';

export const POST = withAuth(async (request: Request) => {
  try {
    const settings = await getSettings();
    if (!settings.telegramBotToken) return NextResponse.json({ error: 'Bot token not configured' }, { status: 400 });
    if (settings.telegramEnabled !== 'true') return NextResponse.json({ error: 'Disabled' }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const mode: string = body.mode || 'all';
    let sentCount = 0;
    const errors: string[] = [];

    if (mode === 'all') {
      if (!settings.telegramChatId) return NextResponse.json({ error: 'Chat ID not set' }, { status: 400 });
      const result = await sendTelegram(settings.telegramChatId, await msgSummary());
      if (result.ok) sentCount++; else errors.push(result.error || '');
    }
    if (mode === 'personal' || mode === 'all') {
      const responsibles = await db.responsible.findMany({ where: { telegram: { not: null }, isActive: true } });
      for (const responsible of responsibles) {
        if (!responsible.telegram) continue;
        const result = await sendTelegram(responsible.telegram, await msgPersonalTasks(responsible.id));
        if (result.ok) sentCount++; else errors.push(`${responsible.name}: ${result.error}`);
      }
    }
    if (mode === 'check' && settings.telegramChatId) {
      const now = new Date();
      const urgent = await db.task.findMany({ where: { status: { in: ['pending', 'in_progress'] }, dueDate: { lte: new Date(now.getTime() + 24 * 60 * 60_000) } }, include: { responsible: { select: { name: true } } } });
      if (urgent.length) {
        const overdue = urgent.filter((task) => task.dueDate < now);
        const today = urgent.filter((task) => task.dueDate >= now);
        const lines: string[] = [];
        if (overdue.length) lines.push(`🔴 <b>Просрочено (${overdue.length}):</b>`, ...overdue.slice(0, 5).map((task) => `• ${task.title}${task.responsible ? ` — ${task.responsible.name}` : ''}`));
        if (today.length) lines.push(`📋 <b>Ближайшие 24 часа (${today.length}):</b>`, ...today.slice(0, 5).map((task) => `• ${task.title}${task.responsible ? ` — ${task.responsible.name}` : ''}`));
        const result = await sendTelegram(settings.telegramChatId, `⚠️ <b>Напоминание о задачах</b>\n\n${lines.join('\n')}`);
        if (result.ok) sentCount++; else errors.push(result.error || '');
      }
    }
    return NextResponse.json({ sent: sentCount, errors: errors.length ? errors : undefined });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
});
