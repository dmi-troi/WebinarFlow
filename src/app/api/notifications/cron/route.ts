import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings, sendTelegram, fmtDate } from '@/lib/telegram/helpers';

async function getSetting(key: string): Promise<string> {
  const s = await db.settings.findUnique({ where: { key } });
  return s?.value || '';
}
async function setSetting(key: string, value: string) {
  await db.settings.upsert({ where: { key }, update: { value }, create: { key, value } });
}

async function sendMorningSummary(chatId: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const lastSent = await getSetting('cron_morning_sent');
  if (lastSent === today.toISOString().slice(0, 10)) return { sent: 0, reason: 'already_sent' };

  const tasks = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: today, lt: tomorrow } },
    include: { responsible: { select: { name: true, telegram: true, email: true } }, webinar: { select: { title: true } } },
    orderBy: { dueDate: 'asc' },
  });
  if (tasks.length === 0) { await setSetting('cron_morning_sent', today.toISOString().slice(0, 10)); return { sent: 0, reason: 'no_tasks' }; }

  let sent = 0;
  const overdue = tasks.filter(t => new Date(t.dueDate) < today);
  const todayT = tasks.filter(t => { const d = new Date(t.dueDate); return d >= today && d < tomorrow; });

  let text = `📋 <b>Задачи на сегодня</b> (${fmtDate(new Date())})\n\n`;
  if (overdue.length > 0) { text += `🔴 <b>Просрочено (${overdue.length}):</b>\n`; for (const t of overdue) { text += `   • ${t.title}${t.responsible ? ` — ${t.responsible.name}` : ''}\n`; } text += '\n'; }
  text += `<b>На сегодня (${todayT.length}):</b>\n`;
  for (const t of todayT) { const who = t.responsible ? ` — <b>${t.responsible.name}</b>` : ''; const time = t.dueDate ? ` ⏰ ${new Date(t.dueDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}` : ''; text += `   • ${t.title}${who}${time}\n`; }

  if (chatId) { const r = await sendTelegram(chatId, text); if (r.ok) sent++; }

  const byResp = new Map<string, typeof tasks>();
  for (const t of tasks) { const key = t.responsibleId || '_none'; if (!byResp.has(key)) byResp.set(key, []); byResp.get(key)!.push(t); }
  for (const [, respTasks] of byResp) {
    const resp = respTasks[0].responsible;
    if (!resp?.telegram) continue;
    let pText = `☀️ <b>Доброе утро, ${resp.name}!</b>\n\nНа сегодня <b>${respTasks.length}</b> задач:\n\n`;
    for (const t of respTasks) { const isOverdue = new Date(t.dueDate) < today; pText += `${isOverdue ? '🔴' : '⚪'} ${t.title}\n`; }
    const r = await sendTelegram(resp.telegram, pText); if (r.ok) sent++;
  }
  await setSetting('cron_morning_sent', today.toISOString().slice(0, 10));
  return { sent };
}

async function send30minReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 25 * 60000);
  const windowEnd = new Date(now.getTime() + 35 * 60000);
  const tasks = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: windowStart, lte: windowEnd } },
    include: { responsible: { select: { name: true, telegram: true } }, webinar: { select: { title: true } } },
  });
  if (tasks.length === 0) return { sent: 0, reason: 'no_upcoming' };
  let sent = 0;
  for (const t of tasks) {
    const reminded = await getSetting(`reminded_${t.id}`);
    if (reminded) continue;
    const time = new Date(t.dueDate).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const webinar = t.webinar ? `\n\n🎬 Вебинар: ${t.webinar.title}` : '';
    const text = `⚠️ <b>Через 30 минут</b>\n\n📅 ${time}\n📝 <b>${t.title}</b>${webinar}`;
    if (t.responsible?.telegram) { const r = await sendTelegram(t.responsible.telegram, text); if (r.ok) sent++; }
    await setSetting(`reminded_${t.id}`, new Date().toISOString());
  }
  return { sent };
}

export async function GET(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  if (!ua.includes('cron-job.org') && process.env.CRON_SECRET && req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const settings = await getSettings();
    if (settings.telegramEnabled !== 'true') return NextResponse.json({ status: 'disabled' });
    const chatId = settings.telegramChatId;
    const hour = parseInt(new Date().toLocaleTimeString('en-US', { timeZone: 'Europe/Moscow', hour: '2-digit', hour12: false }));
    const results: Record<string, unknown> = {};
    if (hour >= 9 && hour < 10) results.morning = await sendMorningSummary(chatId || '');
    results.reminders = await send30minReminders();
    return NextResponse.json({ status: 'ok', mskHour: hour, ...results });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
