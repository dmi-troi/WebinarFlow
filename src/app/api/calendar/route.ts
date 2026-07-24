import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  const webinars = await db.webinar.findMany({
    where: {
      date: start && end ? { gte: new Date(start), lte: new Date(end) } : undefined,
    },
    include: { responsible: true },
  });

  const tasks = await db.task.findMany({
    where: {
      dueDate: start && end ? { gte: new Date(start), lte: new Date(end) } : undefined,
    },
    include: { responsible: true, webinar: true },
  });

  const events = [
    ...webinars.map(w => ({
      id: w.id,
      title: w.title,
      date: w.date,
      type: 'webinar' as const,
      status: w.status,
      responsible: w.responsible?.name,
      color: w.status === 'active' ? '#10b981' : w.status === 'completed' ? '#6b7280' : '#f59e0b',
    })),
    ...tasks.map(t => ({
      id: t.id,
      title: t.title,
      date: t.dueDate,
      type: 'task' as const,
      taskType: t.taskType,
      status: t.status,
      responsible: t.responsible?.name,
      webinarTitle: t.webinar?.title,
      color: t.status === 'done' ? '#10b981' : t.taskType === 'unisender' ? '#3b82f6' : t.taskType === 'mtsLink' ? '#8b5cf6' : t.taskType === 'reminder' ? '#f59e0b' : '#6366f1',
    })),
  ];

  return NextResponse.json(events);
}