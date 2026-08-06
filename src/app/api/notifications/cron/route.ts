import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings, sendTelegram } from '@/lib/telegram/helpers';
import { sendEmail } from '@/lib/email';
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

// Ключ напоминания включает дату — чтобы при переносе задачи оно пришло снова
function reminderKey(taskId: string, dueDate: Date): string {
  return `reminded_${taskId}_${formatInTimeZone(dueDate, MSK, 'yyyyMMdd_HHmm')}`;
}

async function sendMorningSummary(chatId: string, opts: { telegram: boolean; email: boolean }) {
  // «Сегодня» по московскому времени — начало и конец суток в UTC
  const nowMsk = new Date(new Date().toLocaleString('en-US', { timeZone: MSK }));
  const todayMskStr = formatInTimeZone(new Date(), MSK, 'yyyy-MM-dd');
  const dayStart = new Date(`${todayMskStr}T00:00:00+03:00`);
  const dayEnd   = new Date(`${todayMskStr}T23:59:59+03:00`);

  const lastSent = await getSetting('cron_morning_sent');
  if (lastSent === todayMskStr) return { sent: 0, reason: 'already_sent' };

  const tasks = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: dayStart, lte: dayEnd } },
    include: { responsible: { select: { name: true, telegram: true, email: true } }, webinar: { select: { title: true } } },
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

  if (opts.telegram && chatId) { const r = await sendTelegram(chatId, text); if (r.ok) sent++; }

  // Личные уведомления по ответственным (только из today-tasks)
  const byResp = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const key = t.responsibleId || '_none';
    if (!byResp.has(key)) byResp.set(key, []);
    byResp.get(key)!.push(t);
  }
  for (const [, respTasks] of byResp) {
    const resp = respTasks[0].responsible;
    if (!resp) continue;
    if (opts.telegram && resp.telegram) {
      let pText = `☀️ <b>Доброе утро, ${resp.name}!</b>\n\nНа сегодня <b>${respTasks.length}</b> задач:\n\n`;
      for (const t of respTasks) pText += `⏰ ${mskTime(t.dueDate)} — ${t.title}\n`;
      const r = await sendTelegram(resp.telegram, pText);
      if (r.ok) sent++;
    }
    if (opts.email && resp.email) {
      const rows = respTasks.map(t =>
        `<li>⏰ ${mskTime(t.dueDate)} — <b>${t.title}</b>${t.webinar ? ` (${t.webinar.title})` : ''}</li>`
      ).join('');
      const html = `<p>Доброе утро, ${resp.name}!</p><p>На сегодня ${respTasks.length} задач:</p><ul>${rows}</ul>`;
      const r = await sendEmail(resp.email, `Задачи на сегодня (${mskDate(new Date())})`, html);
      if (r.ok) sent++;
    }
  }

  await setSetting('cron_morning_sent', todayMskStr);
  return { sent };
}

async function send30minReminders(opts: { telegram: boolean; email: boolean }) {
  const now = new Date();
  // Окно: от 25 до 35 минут от текущего момента UTC — работает корректно
  // так как dueDate хранится в UTC (после наших правок в msk-time.ts)
  const windowStart = new Date(now.getTime() + 25 * 60_000);
  const windowEnd   = new Date(now.getTime() + 35 * 60_000);

  const tasks = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: windowStart, lte: windowEnd } },
    include: { responsible: { select: { name: true, telegram: true, email: true } }, webinar: { select: { title: true } } },
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

    if (opts.telegram && t.responsible?.telegram) {
      const r = await sendTelegram(t.responsible.telegram, text);
      if (r.ok) sent++;
    }
    if (opts.email && t.responsible?.email) {
      const html = `<p>Через 30 минут: <b>${t.title}</b></p><p>Время: ${time} МСК</p>${t.webinar ? `<p>Вебинар: ${t.webinar.title}</p>` : ''}`;
      const r = await sendEmail(t.responsible.email, `Через 30 минут: ${t.title}`, html);
      if (r.ok) sent++;
    }

    await setSetting(key, now.toISOString());
    sent++;
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
    const emailOn    = settings.emailEnabled === 'true';
    if (!telegramOn && !emailOn) return NextResponse.json({ status: 'disabled' });

    const chatId = settings.telegramChatId;
    const mskHour = parseInt(formatInTimeZone(new Date(), MSK, 'H'));
    const opts = { telegram: telegramOn, email: emailOn };
    const results: Record<string, unknown> = {};

    if (mskHour >= 9 && mskHour < 10) results.morning = await sendMorningSummary(chatId || '', opts);
    results.reminders = await send30minReminders(opts);

    return NextResponse.json({ status: 'ok', mskHour, telegramOn, emailOn, ...results });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unknown' }, { status: 500 });
  }
}
