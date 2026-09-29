import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const GET = withAuth(async () => {
  return NextResponse.json(await db.task.findMany({
    where: { status: { not: 'archived' } },
    include: { webinar: true, responsible: true },
    orderBy: { dueDate: 'asc' },
  }));
});

export const POST = withAuth(async (request: Request) => {
  const data = await request.json().catch(() => ({}));
  if (!data.title || !data.dueDate || Number.isNaN(new Date(data.dueDate).getTime())) return NextResponse.json({ error: 'Название и корректная дата обязательны' }, { status: 400 });
  if (data.webinarId) {
    const webinar = await db.webinar.findUnique({ where: { id: data.webinarId }, select: { status: true } });
    if (!webinar) return NextResponse.json({ error: 'Вебинар не найден' }, { status: 404 });
    if (webinar.status === 'archived') return NextResponse.json({ error: 'Нельзя создать задачу для архивного вебинара' }, { status: 409 });
  }
  const task = await db.task.create({ data: { title: String(data.title).trim(), webinarId: data.webinarId || null, responsibleId: data.responsibleId || null, taskType: data.taskType || 'general', dueDate: new Date(data.dueDate), status: data.status || 'pending' }, include: { webinar: true, responsible: true } });
  return NextResponse.json(task, { status: 201 });
});

export const PUT = withAuth(async (request: Request) => {
  const data = await request.json().catch(() => ({}));
  if (!data.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  const current = await db.task.findUnique({ where: { id: data.id }, select: { status: true } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (current.status === 'archived') return NextResponse.json({ error: 'Архивную задачу нельзя изменять' }, { status: 409 });
  if (data.webinarId) {
    const webinar = await db.webinar.findUnique({ where: { id: data.webinarId }, select: { status: true } });
    if (!webinar) return NextResponse.json({ error: 'Вебинар не найден' }, { status: 404 });
    if (webinar.status === 'archived') return NextResponse.json({ error: 'Нельзя привязать задачу к архивному вебинару' }, { status: 409 });
  }
  if (data.dueDate && Number.isNaN(new Date(data.dueDate).getTime())) return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 });
  const nextStatus = data.status !== undefined ? String(data.status) : current.status;
  const completionData = nextStatus === 'done'
    ? (current.status === 'done' ? undefined : new Date())
    : null;
  const task = await db.task.update({
    where: { id: data.id },
    data: {
      title: data.title !== undefined ? String(data.title).trim() : undefined,
      webinarId: data.webinarId !== undefined ? data.webinarId : undefined,
      responsibleId: data.responsibleId !== undefined ? data.responsibleId : undefined,
      taskType: data.taskType !== undefined ? data.taskType : undefined,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      status: data.status !== undefined ? data.status : undefined,
      completedAt: completionData,
    },
    include: { webinar: true, responsible: true },
  });
  return NextResponse.json(task);
});

export const DELETE = withAuth(async (request: Request) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  const current = await db.task.findUnique({ where: { id }, select: { status: true } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (current.status === 'archived') return NextResponse.json({ error: 'Архивную задачу нельзя удалить из рабочего списка' }, { status: 409 });
  await db.task.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
