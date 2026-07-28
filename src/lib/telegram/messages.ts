import { db } from '@/lib/db';
import { fmtDate, fmtDateTime } from './helpers';

export async function msgHelp(): Promise<string> {
  return `
<b>WebinarFlow Bot</b>\n\n<b>\u041a\u043e\u043c\u0430\u043d\u0434\u044b:</b>\n/today \u2014 \u0437\u0430\u0434\u0430\u0447\u0438 \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f\n/tasks \u2014 \u0432\u0441\u0435 \u043d\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438\n/upcoming \u2014 \u0431\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0435 \u0432\u0435\u0431\u0438\u043d\u0430\u0440\u044b\n/summary \u2014 \u043f\u043e\u043b\u043d\u0430\u044f \u0441\u0432\u043e\u0434\u043a\u0430\n/help \u2014 \u044d\u0442\u043e \u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435\n`;
}

export async function msgToday(): Promise<string> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const tasks = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: today, lt: tomorrow } },
    include: { webinar: { select: { title: true } }, responsible: { select: { name: true } } },
    orderBy: { dueDate: 'asc' },
  });
  if (tasks.length === 0) return '\ud83d\udccb <b>\u0417\u0430\u0434\u0430\u0447\u0438 \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f</b>\n\n\u041f\u0443\u0441\u0442\u043e \u2014 \u0437\u0430\u0434\u0430\u0447 \u043d\u0435\u0442!';
  const lines = tasks.map((t, i) => {
    const webinar = t.webinar ? ` (${t.webinar.title})` : '';
    const who = t.responsible ? ` @ ${t.responsible.name}` : '';
    const icon = t.status === 'in_progress' ? '\ud83d\udd04' : '\u2b1c';
    return `${icon} ${i + 1}. <b>${t.title}</b>${who}${webinar}`;
  });
  return `\ud83d\udccb <b>\u0417\u0430\u0434\u0430\u0447\u0438 \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f</b> (${fmtDate(today)})\n\n${lines.join('\n')}`;
}

export async function msgTasks(): Promise<string> {
  const tasks = await db.task.findMany({
    where: { status: { in: ['pending', 'in_progress'] } },
    include: { webinar: { select: { title: true } }, responsible: { select: { name: true } } },
    orderBy: { dueDate: 'asc' }, take: 20,
  });
  if (tasks.length === 0) return '\u2705 <b>\u041d\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438</b>\n\n\u0412\u0441\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u044b!';
  const lines = tasks.map((t) => {
    const webinar = t.webinar ? ` / ${t.webinar.title}` : '';
    const who = t.responsible ? ` \u2014 <b>${t.responsible.name}</b>` : '';
    const icon = t.status === 'in_progress' ? '\ud83d\udd04' : '\u2b1c';
    const overdue = new Date(t.dueDate) < new Date() ? ' \ud83d\udd34' : '';
    return `${icon} ${t.title}${who}${webinar}\n   \ud83d\udcc5 ${fmtDate(t.dueDate)}${overdue}`;
  });
  const overdue = tasks.filter(t => new Date(t.dueDate) < new Date()).length;
  const header = overdue > 0
    ? `\u26a0\ufe0f <b>\u041d\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438</b> (${tasks.length}, ${overdue} \u043f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e)`
    : `\u2705 <b>\u041d\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043d\u043d\u044b\u0435 \u0437\u0430\u0434\u0430\u0447\u0438</b> (${tasks.length})`;
  return `${header}\n\n${lines.join('\n\n')}`;
}

export async function msgUpcoming(): Promise<string> {
  const webinars = await db.webinar.findMany({
    where: { status: { in: ['planned', 'active'] }, date: { gte: new Date() } },
    include: { responsible: { select: { name: true } } },
    orderBy: { date: 'asc' }, take: 7,
  });
  if (webinars.length === 0) return '\ud83d\udcf9 <b>\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0435 \u0432\u0435\u0431\u0438\u043d\u0430\u0440\u044b</b>\n\n\u0417\u0430\u043f\u043b\u0430\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0445 \u043d\u0435\u0442.';
  const lines = webinars.map((w) => {
    const who = w.responsible ? ` | <b>${w.responsible.name}</b>` : '';
    const icon = w.status === 'active' ? '\ud83d\udd34' : '\u23f3';
    return `${icon} <b>${w.title}</b>${who}\n   \ud83d\udcc5 ${fmtDateTime(w.date)}`;
  });
  return `\ud83d\udcf9 <b>\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0435 \u0432\u0435\u0431\u0438\u043d\u0430\u0440\u044b</b> (${webinars.length})\n\n${lines.join('\n\n')}`;
}

// msgMailings removed — Mailing model does not exist in schema

export async function msgSummary(): Promise<string> {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const [tasks, webinars] = await Promise.all([
    db.task.findMany({ where: { status: { in: ['pending', 'in_progress'] }, dueDate: { gte: today, lt: tomorrow } }, include: { responsible: { select: { name: true } } } }),
    db.webinar.findMany({ where: { status: { in: ['planned', 'active'] }, date: { gte: new Date() } }, include: { responsible: { select: { name: true } } }, orderBy: { date: 'asc' }, take: 5 }),
  ]);
  const overdue = await db.task.count({ where: { status: { in: ['pending', 'in_progress'] }, dueDate: { lt: new Date() } } });
  let msg = '\ud83d\udcca <b>\u0421\u0432\u043e\u0434\u043a\u0430 WebinarFlow</b>\n';
  msg += `\ud83d\udd50 ${fmtDateTime(new Date())}\n\n`;
  msg += `\ud83d\udccb <b>\u0417\u0430\u0434\u0430\u0447\u0438 \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f:</b> ${tasks.length}\n`;
  for (const t of tasks.slice(0, 5)) { const who = t.responsible ? ` (${t.responsible.name})` : ''; msg += `   \u2022 ${t.title}${who}\n`; }
  msg += '\n';
  if (overdue > 0) msg += `\ud83d\udd34 <b>\u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e:</b> ${overdue}\n\n`;
  msg += `\ud83d\udcf9 <b>\u0411\u043b\u0438\u0436\u0430\u0439\u0448\u0438\u0435 \u0432\u0435\u0431\u0438\u043d\u0430\u0440\u044b:</b> ${webinars.length}\n`;
  for (const w of webinars) { const who = w.responsible ? ` (${w.responsible.name})` : ''; msg += `   \u2022 ${w.title} \u2014 ${fmtDate(w.date)}${who}\n`; }
  return msg;
}

export async function msgPersonalTasks(responsibleId: string): Promise<string> {
  const responsible = await db.responsible.findUnique({ where: { id: responsibleId }, select: { name: true } });
  if (!responsible) return '\u274c \u041e\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekLater = new Date(today); weekLater.setDate(weekLater.getDate() + 7);
  const [todayTasks, upcomingTasks, overdueTasks] = await Promise.all([
    db.task.count({ where: { responsibleId, status: { in: ['pending', 'in_progress'] }, dueDate: { gte: today, lt: new Date(today.getTime() + 86400000) } } }),
    db.task.findMany({ where: { responsibleId, status: { in: ['pending', 'in_progress'] }, dueDate: { gte: today, lte: weekLater } }, orderBy: { dueDate: 'asc' }, take: 5 }),
    db.task.count({ where: { responsibleId, status: { in: ['pending', 'in_progress'] }, dueDate: { lt: today } } }),
  ]);
  let msg = `\ud83d\udc64 <b>${responsible.name} \u2014 \u0432\u0430\u0448\u0438 \u0437\u0430\u0434\u0430\u0447\u0438</b>\n\n`;
  if (overdueTasks > 0) msg += `\ud83d\udd34 \u041f\u0440\u043e\u0441\u0440\u043e\u0447\u0435\u043d\u043e: <b>${overdueTasks}</b>\n\n`;
  msg += `\ud83d\udccb \u0421\u0435\u0433\u043e\u0434\u043d\u044f: <b>${todayTasks}</b>\n\n`;
  if (upcomingTasks.length > 0) {
    msg += '\u041d\u0430 \u044d\u0442\u043e\u0439 \u043d\u0435\u0434\u0435\u043b\u0435:\n';
    for (const t of upcomingTasks) {
      const icon = new Date(t.dueDate) < new Date() ? '\ud83d\udd34' : '\u2b1c';
      msg += `${icon} ${t.title} \u2014 ${fmtDate(t.dueDate)}\n`;
    }
  } else if (todayTasks === 0 && overdueTasks === 0) msg += '\ud83c\udf89 \u041d\u0435\u0442 \u0437\u0430\u0434\u0430\u0447 \u043d\u0430 \u044d\u0442\u043e\u0439 \u043d\u0435\u0434\u0435\u043b\u0435!';
  return msg;
}
