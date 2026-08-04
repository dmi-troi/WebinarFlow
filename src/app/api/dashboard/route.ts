import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  // Moscow timezone offset to get correct "today" on Render (UTC)
  const mskOffset = 3 * 60 * 60 * 1000;
  const now = new Date();
  const mskNow = new Date(now.getTime() + mskOffset);
  const todayStart = new Date(mskNow.getFullYear(), mskNow.getMonth(), mskNow.getDate());
  todayStart.setTime(todayStart.getTime() - mskOffset); // back to UTC for DB query
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);

  const [totalWebinars, activeWebinars, totalTasks, todayTasks, upcomingTasks] =
    await Promise.all([
      db.webinar.count(),
      db.webinar.count({ where: { status: 'active' } }),
      db.task.count(),
      db.task.count({
        where: { dueDate: { gte: todayStart, lt: todayEnd } },
      }),
      db.task.findMany({
        where: { dueDate: { gte: todayStart, lt: tomorrowEnd }, status: { not: 'done' } },
        include: { webinar: true, responsible: true },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
    ]);

  const completedTasks = await db.task.count({ where: { status: 'done' } });

  return NextResponse.json({
    totalWebinars,
    activeWebinars,
    totalTasks,
    todayTasks,
    completedTasks,
    pendingTasks: totalTasks - completedTasks,
    upcomingTasks,
  });
}