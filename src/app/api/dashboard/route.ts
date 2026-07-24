import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const tomorrowEnd = new Date(todayEnd);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

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