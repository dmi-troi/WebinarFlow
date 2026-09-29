import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import type { Prisma } from '@prisma/client';
import { shiftToBusinessDay } from '@/lib/business-days';
import { NextResponse } from 'next/server';

export const GET = withAuth(async () => {
  return NextResponse.json(await db.webinar.findMany({
    where: { status: { not: 'archived' } },
    include: { responsible: true, tasks: { where: { status: { not: 'archived' } } } },
    orderBy: { date: 'asc' },
  }));
});

export const POST = withAuth(async (request: Request) => {
  const data = await request.json().catch(() => ({}));
  if (!data.title || !data.date || Number.isNaN(new Date(data.date).getTime())) return NextResponse.json({ error: 'Название и корректная дата обязательны' }, { status: 400 });
  const webinar = await db.webinar.create({
    data: { title: String(data.title).trim(), description: data.description || null, date: new Date(data.date), responsibleId: data.responsibleId || null, email: data.email || null, status: data.status || 'planned' },
    include: { responsible: true, tasks: true },
  });
  return NextResponse.json(webinar, { status: 201 });
});

export const PUT = withAuth(async (request: Request) => {
  const data = await request.json().catch(() => ({}));
  if (!data.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  const current = await db.webinar.findUnique({ where: { id: data.id } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (current.status === 'archived') return NextResponse.json({ error: 'Архивный вебинар нельзя изменять' }, { status: 409 });

  const newDate = data.date ? new Date(data.date) : current.date;
  if (Number.isNaN(newDate.getTime())) return NextResponse.json({ error: 'Некорректная дата' }, { status: 400 });
  const settings = await db.settings.findMany({ where: { key: { in: ['autoRecalc', 'taskShiftDirection', 'maxShiftDays'] } } });
  const sm = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const autoRecalc = sm.autoRecalc !== 'false';
  const direction = sm.taskShiftDirection === 'forward' ? 'forward' : 'back';
  const maxShiftDays = Math.max(1, parseInt(sm.maxShiftDays || '7', 10) || 7);
  const dateChanged = current.date.getTime() !== newDate.getTime();

  const writes: Prisma.PrismaPromise<unknown>[] = [db.webinar.update({
    where: { id: data.id },
    data: {
      title: data.title !== undefined ? String(data.title).trim() : undefined,
      description: data.description !== undefined ? data.description : undefined,
      date: data.date ? newDate : undefined,
      responsibleId: data.responsibleId !== undefined ? data.responsibleId : undefined,
      email: data.email !== undefined ? data.email : undefined,
      status: data.status !== undefined ? data.status : undefined,
      mtsLinkWebinarId: data.mtsLinkWebinarId !== undefined ? (data.mtsLinkWebinarId || null) : undefined,
      mtsLinkEventId: data.mtsLinkEventId !== undefined ? (data.mtsLinkEventId || null) : undefined,
      mtsLinkEventSessionId: data.mtsLinkEventSessionId !== undefined ? (data.mtsLinkEventSessionId || null) : undefined,
      mtsLinkUrl: data.mtsLinkUrl !== undefined ? (data.mtsLinkUrl || null) : undefined,
      mtsLinkLastSyncAt: data.mtsLinkLastSyncAt !== undefined ? (data.mtsLinkLastSyncAt ? new Date(data.mtsLinkLastSyncAt) : null) : undefined,
    },
    include: { responsible: true, tasks: true },
  })];

  if (dateChanged && autoRecalc) {
    const deltaMs = newDate.getTime() - current.date.getTime();
    const holidays = await db.holiday.findMany({ select: { date: true } });
    const tasks = await db.task.findMany({ where: { webinarId: current.id, status: { in: ['pending', 'in_progress'] } } });
    for (const task of tasks) {
      const shifted = new Date(task.dueDate.getTime() + deltaMs);
      const business = shiftToBusinessDay(shifted, holidays, direction, maxShiftDays);
      writes.push(db.task.update({ where: { id: task.id }, data: { dueDate: business } }));
    }
  }

  const [updated] = await db.$transaction(writes);
  return NextResponse.json(updated);
});

export const DELETE = withAuth(async (request: Request) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  const current = await db.webinar.findUnique({ where: { id }, select: { status: true } });
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (current.status === 'archived') return NextResponse.json({ error: 'Архивный вебинар уже находится в архиве' }, { status: 409 });
  await db.$transaction([
    db.task.deleteMany({ where: { webinarId: id } }),
    db.webinar.delete({ where: { id } }),
  ]);
  return NextResponse.json({ success: true });
});
