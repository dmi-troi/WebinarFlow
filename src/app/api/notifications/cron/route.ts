import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSettings, sendTelegram } from '@/lib/telegram/helpers';
import { formatInTimeZone } from 'date-fns-tz';

const MSK = 'Europe/Moscow';
function mskTime(d: Date | string) { return formatInTimeZone(d, MSK, 'HH:mm'); }
function mskDate(d: Date | string) { return formatInTimeZone(d, MSK, 'd MMMM yyyy'); }
async function getSetting(key: string) { const s = await db.settings.findUnique({ where: { key } }); return s?.value || ''; }
async function setSetting(key: string, value: string) { await db.settings.upsert({ where: { key }, update: { value }, create: { key, value } }); }

async function isAuthorized(req: Request) {
  const dbSecret = await getSetting('cronSecret');
  const envSecret = process.env.CRON_SECRET || '';
  const authorization = req.headers.get('authorization') || '';
  const headerSecret = req.headers.get('x-cron-secret') || '';
  const bearerSecret = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const candidates = [envSecret, dbSecret].filter(Boolean);
  if (!candidates.length) return false;
  return candidates.includes(bearerSecret) || candidates.includes(headerSecret.trim());
}

function reminderKey(taskId: string, dueDate: Date) { return `reminded_${taskId}_${formatInTimeZone(dueDate, MSK, 'yyyyMMdd_HHmm')}`; }

async function sendMorningSummary(chatId: string, telegramOn: boolean) {
  const day = formatInTimeZone(new Date(), MSK, 'yyyy-MM-dd');
  const dayStart = new Date(`${day}T00:00:00+03:00`);
  const dayEnd = new Date(`${day}T23:59:59+03:00`);
  if (await getSetting('cron_morning_sent') === day) return { sent: 0, reason: 'already_sent' };

  const [tasks, overdueAll] = await Promise.all([
    db.task.findMany({ where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: dayStart, lte: dayEnd } }, include: { responsible: { select: { name: true, telegram: true } }, webinar: { select: { title: true } } }, orderBy: { dueDate: 'asc' } }),
    db.task.findMany({ where: { status: { in: ['pending', 'in_progress'] }, dueDate: { lt: dayStart } }, include: { responsible: { select: { name: true } }, webinar: { select: { title: true } } }, orderBy: { dueDate: 'asc' } }),
  ]);
  if (tasks.length === 0 && overdueAll.length === 0) { await setSetting('cron_morning_sent', day); return { sent: 0, reason: 'no_tasks' }; }
  let sent = 0;
  if (telegramOn && chatId) {
    let text = `📋 <b>Задачи на сегодня</b> (${mskDate(new Date())})\n\n`;
    if (overdueAll.length) text += `🔴 <b>Просрочено (${overdueAll.length}):</b>\n${overdueAll.map((t) => `   • ${t.title}${t.responsible ? ` — ${t.responsible.name}` : ''}`).join('\n')}\n\n`;
    if (tasks.length) text += `<b>На сегодня (${tasks.length}):</b>\n${tasks.map((t) => `   • ${t.title}${t.responsible ? ` — <b>${t.responsible.name}</b>` : ''} ⏰ ${mskTime(t.dueDate)}`).join('\n')}`;
    if ((await sendTelegram(chatId, text)).ok) sent++;
  }
  const byResp = new Map<string, typeof tasks>();
  for (const t of tasks) { const key = t.responsibleId || '_none'; if (!byResp.has(key)) byResp.set(key, []); byResp.get(key)!.push(t); }
  for (const [, respTasks] of byResp) {
    const resp = respTasks[0].responsible;
    if (!resp?.telegram || !telegramOn) continue;
    const text = `☀️ <b>Доброе утро, ${resp.name}!</b>\n\nНа сегодня <b>${respTasks.length}</b> задач:\n\n${respTasks.map((t) => `⏰ ${mskTime(t.dueDate)} — ${t.title}`).join('\n')}`;
    if ((await sendTelegram(resp.telegram, text)).ok) sent++;
  }
  await setSetting('cron_morning_sent', day);
  return { sent };
}

async function send30minReminders(telegramOn: boolean, chatId: string) {
  const now = new Date();
  const tasks = await db.task.findMany({ where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: new Date(now.getTime() + 25 * 60_000), lte: new Date(now.getTime() + 35 * 60_000) } }, include: { responsible: { select: { name: true, telegram: true } }, webinar: { select: { title: true } } } });
  let sent = 0;
  for (const task of tasks) {
    if (await getSetting(reminderKey(task.id, task.dueDate))) continue;
    const text = `⚠️ <b>Через 30 минут</b>\n\n📅 ${mskTime(task.dueDate)} МСК\n📝 <b>${task.title}</b>${task.webinar ? `\n\n🎬 Вебинар: ${task.webinar.title}` : ''}`;
    let ok = false;
    if (telegramOn && task.responsible?.telegram) ok = (await sendTelegram(task.responsible.telegram, text)).ok;
    else if (telegramOn && chatId) ok = (await sendTelegram(chatId, text)).ok;
    if (ok) { sent++; await setSetting(reminderKey(task.id, task.dueDate), now.toISOString()); }
  }
  return { sent };
}

async function autoArchiveCompleted() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000);

  const [tasks, webinars] = await Promise.all([
    db.task.findMany({
      where: {
        status: 'done',
        OR: [
          { completedAt: { lte: cutoff } },
          { completedAt: null, updatedAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
    }),
    db.webinar.findMany({
      where: {
        status: 'completed',
        OR: [
          { completedAt: { lte: cutoff } },
          { completedAt: null, updatedAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
    }),
  ]);

  if (!tasks.length && !webinars.length) {
    return { tasks: 0, webinars: 0 };
  }

  await db.$transaction([
    ...tasks.map((task) => db.task.update({
      where: { id: task.id },
      data: { status: 'archived' },
    })),
    ...webinars.map((webinar) => db.webinar.update({
      where: { id: webinar.id },
      data: { status: 'archived' },
    })),
  ]);

  return { tasks: tasks.length, webinars: webinars.length };
}

export async function GET(req: Request) {
  if (!(await isAuthorized(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const settings = await getSettings();
    const telegramOn = settings.telegramEnabled === 'true';
    const results: Record<string, unknown> = {};
    // Автоархивация завершённых объектов не зависит от Telegram и работает всегда.
    results.autoArchive = await autoArchiveCompleted();
    if (!telegramOn) return NextResponse.json({ status: 'telegram_disabled', telegramOn, ...results });
    const mskHour = parseInt(formatInTimeZone(new Date(), MSK, 'H'), 10);
    if (mskHour >= 9 && mskHour < 10) results.morning = await sendMorningSummary(settings.telegramChatId || '', telegramOn);
    results.reminders = await send30minReminders(telegramOn, settings.telegramChatId || '');
    return NextResponse.json({ status: 'ok', mskHour, telegramOn, ...results });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 }); }
}
