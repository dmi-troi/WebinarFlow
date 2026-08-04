import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const tasks = await db.task.findMany({
    include: { webinar: true, responsible: true },
    orderBy: { dueDate: 'asc' },
  });
  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const data = await request.json();
  const task = await db.task.create({
    data: {
      title: data.title,
      webinarId: data.webinarId || null,
      responsibleId: data.responsibleId || null,
      taskType: data.taskType || 'general',
      dueDate: new Date(data.dueDate),
      status: data.status || 'pending',
    },
    include: { webinar: true, responsible: true },
  });
  return NextResponse.json(task, { status: 201 });
}

export async function PUT(request: Request) {
  const data = await request.json();
  const task = await db.task.update({
    where: { id: data.id },
    data: {
      title: data.title,
      webinarId: data.webinarId !== undefined ? data.webinarId : undefined,
      responsibleId: data.responsibleId !== undefined ? data.responsibleId : undefined,
      taskType: data.taskType !== undefined ? data.taskType : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      status: data.status !== undefined ? data.status : undefined,
    },
    include: { webinar: true, responsible: true },
  });
  return NextResponse.json(task);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await db.task.delete({ where: { id } });
  return NextResponse.json({ success: true });
}