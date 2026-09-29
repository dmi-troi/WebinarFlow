import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import { fromZonedTime } from 'date-fns-tz';
import { NextResponse } from 'next/server';

const MSK = 'Europe/Moscow';

function mskDayStart() {
  const now = new Date();
  const y = now.toLocaleDateString('en-CA', { timeZone: MSK });
  return fromZonedTime(`${y}T00:00:00`, MSK);
}

export const GET = withAuth(async () => {
  const todayStart = mskDayStart();
  const todayEnd = new Date(todayStart); todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);
  const tomorrowEnd = new Date(todayEnd); tomorrowEnd.setUTCDate(tomorrowEnd.getUTCDate() + 1);
  const [totalWebinars, activeWebinars, totalTasks, todayTasks, upcomingTasks, completedTasks] = await Promise.all([
    db.webinar.count({ where: { status: { not: 'archived' } } }),
    db.webinar.count({ where: { status: 'active' } }),
    db.task.count({ where: { status: { not: 'archived' } } }),
    db.task.count({ where: { status: { not: 'archived' }, dueDate: { gte: todayStart, lt: todayEnd } } }),
    db.task.findMany({ where: { status: { notIn: ['done', 'archived'] }, dueDate: { gte: todayStart, lt: tomorrowEnd } }, include: { webinar: true, responsible: true }, orderBy: { dueDate: 'asc' }, take: 5 }),
    db.task.count({ where: { status: 'done' } }),
  ]);
  return NextResponse.json({ totalWebinars, activeWebinars, totalTasks, todayTasks, completedTasks, pendingTasks: totalTasks - completedTasks, upcomingTasks });
});
