import { db } from '@/lib/db';
import { fmtDate, fmtDateTime } from './helpers';
import { formatInTimeZone } from 'date-fns-tz';

const MSK = 'Europe/Moscow';

function mskStartOfToday(): Date {
  const day = formatInTimeZone(new Date(), MSK, 'yyyy-MM-dd');
  return new Date(`${day}T00:00:00+03:00`);
}

function mskStartOfTomorrow(): Date {
  const tomorrow = new Date(mskStartOfToday().getTime() + 24 * 60 * 60_000);
  const day = formatInTimeZone(tomorrow, MSK, 'yyyy-MM-dd');
  return new Date(`${day}T00:00:00+03:00`);
}

export async function msgHelp(): Promise<string> {
  return `
<b>WebinarFlow Bot</b>\n\n<b>Команды:</b>\n/today — задачи на сегодня\n/tasks — все незавершённые задачи\n/upcoming — ближайшие вебинары\n/summary — полная сводка\n/help — это сообщение\n`;
}

export async function msgToday(): Promise<string> {
  const today = mskStartOfToday();
  const tomorrow = mskStartOfTomorrow();
  const tasks = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: today, lt: tomorrow } },
    include: { webinar: { select: { title: true } }, responsible: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  });
  if (tasks.length === 0) return '📋 <b>Задачи на сегодня</b>\n\nПусто — задач нет!';
  const lines = tasks.map((t, i) => {
    const webinar = t.webinar ? ` (${t.webinar.title})` : '';
    const who = t.responsible ? ` @ ${t.responsible.name}` : '';
    const icon = t.status === 'in_progress' ? '🔄' : '⬜';
    return `${icon} ${i + 1}. <b>${t.title}</b>${who}${webinar}`;
  });
  return `📋 <b>Задачи на сегодня</b> (${fmtDate(today)})\n\n${lines.join('\n')}`;
}

export async function msgTasks(): Promise<string> {
  const tasks = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] } },
    include: { webinar: { select: { title: true } }, responsible: { select: { name: true } } },
    orderBy: { dueDate: 'asc' }, take: 20,
  });
  if (tasks.length === 0) return '✅ <b>Незавершённые задачи</b>\n\nВсе задачи выполнены!';
  const lines = tasks.map((t) => {
    const webinar = t.webinar ? ` / ${t.webinar.title}` : '';
    const who = t.responsible ? ` — <b>${t.responsible.name}</b>` : '';
    const icon = t.status === 'in_progress' ? '🔄' : '⬜';
    const overdue = new Date(t.dueDate) < new Date() ? ' 🔴' : '';
    return `${icon} ${t.title}${who}${webinar}\n   📅 ${fmtDate(t.dueDate)}${overdue}`;
  });
  const overdue = tasks.filter(t => new Date(t.dueDate) < new Date()).length;
  const header = overdue > 0
    ? `⚠️ <b>Незавершённые задачи</b> (${tasks.length}, ${overdue} просрочено)`
    : `✅ <b>Незавершённые задачи</b> (${tasks.length})`;
  return `${header}\n\n${lines.join('\n\n')}`;
}

export async function msgUpcoming(): Promise<string> {
  const webinars = await db.webinar.findMany({
    where: { status: { in: ['planned', 'active'] }, date: { gte: new Date() } },
    include: { responsible: { select: { name: true } } },
    orderBy: { date: 'asc' }, take: 7,
  });
  if (webinars.length === 0) return '📹 <b>Ближайшие вебинары</b>\n\nЗапланированных нет.';
  const lines = webinars.map((w) => {
    const who = w.responsible ? ` | <b>${w.responsible.name}</b>` : '';
    const icon = w.status === 'active' ? '🔴' : '⏳';
    return `${icon} <b>${w.title}</b>${who}\n   📅 ${fmtDateTime(w.date)}`;
  });
  return `📹 <b>Ближайшие вебинары</b> (${webinars.length})\n\n${lines.join('\n\n')}`;
}

export async function msgSummary(): Promise<string> {
  const today = mskStartOfToday();
  const tomorrow = mskStartOfTomorrow();
  const [tasks, webinars] = await Promise.all([
    db.task.findMany({ where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: today, lt: tomorrow } }, include: { responsible: { select: { name: true } } } }),
    db.webinar.findMany({ where: { status: { in: ['planned', 'active'] }, date: { gte: new Date() } }, include: { responsible: { select: { name: true } } }, orderBy: { date: 'asc' }, take: 5 }),
  ]);
  const overdue = await db.task.count({ where: { status: { in: ['pending', 'in_progress'] }, dueDate: { lt: new Date() } } });
  let msg = '📊 <b>Сводка WebinarFlow</b>\n';
  msg += `🕐 ${fmtDateTime(new Date())}\n\n`;
  msg += `📋 <b>Задачи на сегодня:</b> ${tasks.length}\n`;
  for (const t of tasks.slice(0, 5)) { const who = t.responsible ? ` (${t.responsible.name})` : ''; msg += `   • ${t.title}${who}\n`; }
  msg += '\n';
  if (overdue > 0) msg += `🔴 <b>Просрочено:</b> ${overdue}\n\n`;
  msg += `📹 <b>Ближайшие вебинары:</b> ${webinars.length}\n`;
  for (const w of webinars) { const who = w.responsible ? ` (${w.responsible.name})` : ''; msg += `   • ${w.title} — ${fmtDate(w.date)}${who}\n`; }
  return msg;
}

export async function msgPersonalTasks(responsibleId: string): Promise<string> {
  const responsible = await db.responsible.findUnique({ where: { id: responsibleId }, select: { name: true } });
  if (!responsible) return '❌ Ответственный не найден';
  const today = mskStartOfToday();
  const tomorrow = mskStartOfTomorrow();
  const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60_000);
  const [todayTasks, upcomingTasks, overdueTasks] = await Promise.all([
    db.task.count({ where: { responsibleId, status: { in: ['pending', 'in_progress'] }, dueDate: { gte: today, lt: tomorrow } } }),
    db.task.findMany({ where: { responsibleId, status: { in: ['pending', 'in_progress'] }, dueDate: { gte: today, lte: weekLater } }, orderBy: { dueDate: 'asc' }, take: 5 }),
    db.task.count({ where: { responsibleId, status: { in: ['pending', 'in_progress'] }, dueDate: { lt: today } } }),
  ]);
  let msg = `👤 <b>${responsible.name} — ваши задачи</b>\n\n`;
  if (overdueTasks > 0) msg += `🔴 Просрочено: <b>${overdueTasks}</b>\n\n`;
  msg += `📋 Сегодня: <b>${todayTasks}</b>\n\n`;
  if (upcomingTasks.length > 0) {
    msg += 'На этой неделе:\n';
    for (const t of upcomingTasks) {
      const icon = new Date(t.dueDate) < new Date() ? '🔴' : '⬜';
      msg += `${icon} ${t.title} — ${fmtDate(t.dueDate)}\n`;
    }
  } else if (todayTasks === 0 && overdueTasks === 0) msg += '🎉 Нет задач на этой неделе!';
  return msg;
}
