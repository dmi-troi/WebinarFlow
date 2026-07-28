import { NextResponse } from 'next/server';
import { getSettings, sendTelegram } from '@/lib/telegram/helpers';
import { msgSummary, msgPersonalTasks } from '@/lib/telegram/messages';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const settings = await getSettings();
    if (!settings.telegramBotToken) return NextResponse.json({ error: 'Bot token not configured' }, { status: 400 });
    if (settings.telegramEnabled !== 'true') return NextResponse.json({ error: 'Disabled' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const mode: string = body.mode || 'all';
    let sentCount = 0;
    const errors: string[] = [];

    if (mode === 'all') {
      const chatId = settings.telegramChatId;
      if (!chatId) return NextResponse.json({ error: 'Chat ID not set' }, { status: 400 });
      const text = await msgSummary();
      const r = await sendTelegram(chatId, text);
      if (r.ok) sentCount++; else errors.push(r.error || '');
    }

    if (mode === 'personal' || mode === 'all') {
      const responsibles = await db.responsible.findMany({ where: { telegram: { not: null }, isActive: true } });
      for (const r of responsibles) {
        if (!r.telegram) continue;
        const text = await msgPersonalTasks(r.id);
        const result = await sendTelegram(r.telegram, text);
        if (result.ok) sentCount++; else errors.push(`${r.name}: ${result.error}`);
      }
    }

    if (mode === 'check') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const urgent = await db.task.findMany({
        where: { status: { in: ['pending', 'in_progress'] }, dueDate: { lte: new Date(today.getTime() + 86400000) } },
        include: { responsible: { select: { name: true, telegram: true } } },
      });
      if (urgent.length === 0) return NextResponse.json({ sent: 0, message: 'No urgent tasks' });
      const chatId = settings.telegramChatId;
      if (chatId) {
        const overdue = urgent.filter(t => new Date(t.dueDate) < today);
        const todayT = urgent.filter(t => { const d = new Date(t.dueDate); return d >= today && d < new Date(today.getTime() + 86400000); });
        const lines: string[] = [];
        if (overdue.length > 0) { lines.push('🔴 <b>Просрочено (' + overdue.length + '):</b>'); overdue.slice(0, 5).forEach(t => { lines.push('   • ' + t.title + (t.responsible ? ' — ' + t.responsible.name : '')); }); }
        if (todayT.length > 0) { lines.push('📋 <b>На сегодня (' + todayT.length + '):</b>'); todayT.slice(0, 5).forEach(t => { lines.push('   • ' + t.title + (t.responsible ? ' — ' + t.responsible.name : '')); }); }
        const text = '⚠️ <b>Напоминание о задачах</b>\n\n' + lines.join('\n');
        const r = await sendTelegram(chatId, text);
        if (r.ok) sentCount++; else errors.push(r.error || '');
      }
    }

    return NextResponse.json({ sent: sentCount, errors: errors.length > 0 ? errors : undefined });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
