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
      reminderTime: data.reminderTime || null,
      status: data.status || 'pending',
    },
    include: { webinar: true, responsible: true },
  });
  return NextResponse.json(task, { status: 201 });
}

export async function PUT(request: Request) {
  const data = await request.json();

  // Строим объект обновления ТОЛЬКО из полей, которые пришли в запросе.
  // Никогда не передаём undefined в Prisma — это исключает
  // случайное обнуление nullable-полей (reminderTime, webinarId, …)
  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.webinarId !== undefined) updateData.webinarId = data.webinarId;
  if (data.responsibleId !== undefined) updateData.responsibleId = data.responsibleId;
  if (data.taskType !== undefined) updateData.taskType = data.taskType;
  if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
  if (data.reminderTime !== undefined) updateData.reminderTime = data.reminderTime;
  if (data.status !== undefined) updateData.status = data.status;

  const task = await db.task.update({
    where: { id: data.id },
    data: updateData,
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
