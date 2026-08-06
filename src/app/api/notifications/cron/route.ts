import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings, sendTelegram } from '@/lib/telegram/helpers';
import { formatInTimeZone } from 'date-fns-tz';
import { ru } from 'date-fns/locale';

const MSK = 'Europe/Moscow';

function mskTime(d: Date | string) {
  return formatInTimeZone(d, MSK, 'HH:mm', { locale: ru });
}
function mskDate(d: Date | string) {
  return formatInTimeZone(d, MSK, 'd MMMM yyyy', { locale: ru });
}

async function getSetting(key: string): Promise<string> {
  const s = await db.settings.findUnique({ where: { key } });
  return s?.value || '';
}
async function setSetting(key: string, value: string) {
  await db.settings.upsert({ where: { key }, update: { value }, create: { key, value } });
}

function reminderKey(taskId: string, dueDate: Date): string {
  return `reminded_${taskId}_${formatInTimeZone(dueDate, MSK, 'yyyyMMdd_HHmm')}`;
}

async function sendMorningSummary(chatId: string, telegramOn: boolean) {
  const todayMskStr = formatInTimeZone(new Date(), MSK, 'yyyy-MM-dd');
  const dayStart = new Date(`${todayMskStr}T00:00:00+03:00`);
  const dayEnd   = new Date(`${todayMskStr}T23:59:59+03:00`);

  const lastSent = await getSetting('cron_morning_sent');
  if (lastSent === todayMskStr) return { sent: 0, reason: 'already_sent' };

  const tasks = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: dayStart, lte: dayEnd } },
    include: { responsible: { select: { name: true, telegram: true } }, webinar: { select: { title: true } } },
    orderBy: { dueDate: 'asc' },
  });

  const overdueAll = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] }, dueDate: { lt: dayStart } },
    include: { responsible: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  });

  if (tasks.length === 0 && overdueAll.length === 0) {
    await setSetting('cron_morning_sent', todayMskStr);
    return { sent: 0, reason: 'no_tasks' };
  }

  let sent = 0;

  if (telegramOn && chatId) {
    let text = `📋 <b>Задачи на сегодня</b> (${mskDate(new Date())})\n\n`;
    if (overdueAll.length > 0) {
      text += `🔴 <b>Просрочено (${overdueAll.length}):</b>\n`;
      for (const t of overdueAll) text += `   • ${t.title}${t.responsible ? ` — ${t.responsible.name}` : ''}\n`;
      text += '\n';
    }
    if (tasks.length > 0) {
      text += `<b>На сегодня (${tasks.length}):</b>\n`;
      for (const t of tasks) {
        const who = t.responsible ? ` — <b>${t.responsible.name}</b>` : '';
        text += `   • ${t.title}${who} ⏰ ${mskTime(t.dueDate)}\n`;
      }
    }
    const r = await sendTelegram(chatId, text);
    if (r.ok) sent++;
  }

  // Личные уведомления по ответственным
  const byResp = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const key = t.responsibleId || '_none';
    if (!byResp.has(key)) byResp.set(key, []);
    byResp.get(key)!.push(t);
  }
  for (const [, respTasks] of byResp) {
    const resp = respTasks[0].responsible;
    if (!resp?.telegram || !telegramOn) continue;
    let pText = `☀️ <b>Доброе утро, ${resp.name}!</b>\n\nНа сегодня <b>${respTasks.length}</b> задач:\n\n`;
    for (const t of respTasks) pText += `⏰ ${mskTime(t.dueDate)} — ${t.title}\n`;
    const r = await sendTelegram(resp.telegram, pText);
    if (r.ok) sent++;
  }

  await setSetting('cron_morning_sent', todayMskStr);
  return { sent };
}

async function send30minReminders(telegramOn: boolean) {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 25 * 60_000);
  const windowEnd   = new Date(now.getTime() + 35 * 60_000);

  const tasks = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: windowStart, lte: windowEnd } },
    include: { responsible: { select: { name: true, telegram: true } }, webinar: { select: { title: true } } },
  });

  if (tasks.length === 0) return { sent: 0, reason: 'no_upcoming' };

  let sent = 0;
  for (const t of tasks) {
    const key = reminderKey(t.id, t.dueDate);
    const reminded = await getSetting(key);
    if (reminded) continue;

    const time = mskTime(t.dueDate);
    const webinar = t.webinar ? `\n\n🎬 Вебинар: ${t.webinar.title}` : '';
    const text = `⚠️ <b>Через 30 минут</b>\n\n📅 ${time} МСК\n📝 <b>${t.title}</b>${webinar}`;

    if (telegramOn && t.responsible?.telegram) {
      const r = await sendTelegram(t.responsible.telegram, text);
      if (r.ok) sent++;
    }

    await setSetting(key, now.toISOString());
  }
  return { sent };
}

export async function GET(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  if (
    !ua.includes('cron-job.org') &&
    process.env.CRON_SECRET &&
    req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const settings = await getSettings();
    const telegramOn = settings.telegramEnabled === 'true';
    if (!telegramOn) return NextResponse.json({ status: 'disabled' });

    const chatId = settings.telegramChatId;
    const mskHour = parseInt(formatInTimeZone(new Date(), MSK, 'H'));
    const results: Record<string, unknown> = {};

    if (mskHour >= 9 && mskHour < 10) results.morning = await sendMorningSummary(chatId || '', telegramOn);
    results.reminders = await send30minReminders(telegramOn);

    return NextResponse.json({ status: 'ok', mskHour, telegramOn, ...results });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
