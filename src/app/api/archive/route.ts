import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

export const GET = withAuth(async () => {
  const [archivedWebinars, archivedTasks, legacyWebinars, legacyTasks] = await Promise.all([
    db.webinar.findMany({ where: { status: 'archived' }, include: { responsible: true, tasks: true }, orderBy: { updatedAt: 'desc' } }),
    db.task.findMany({ where: { status: 'archived' }, include: { responsible: true, webinar: true }, orderBy: { updatedAt: 'desc' } }),
    db.archiveWebinar.findMany({ orderBy: { archivedAt: 'desc' } }),
    db.archiveTask.findMany({ orderBy: { archivedAt: 'desc' } }),
  ]);
  return NextResponse.json({
    webinars: [
      ...archivedWebinars.map((w) => ({ ...w, archiveSource: 'live' })),
      ...legacyWebinars.map((w) => ({ ...w, archiveSource: 'legacy' })),
    ],
    tasks: [
      ...archivedTasks.map((t) => ({ ...t, archiveSource: 'live' })),
      ...legacyTasks.map((t) => ({ ...t, archiveSource: 'legacy' })),
    ],
  });
});

export const POST = withAuth(async (request: Request) => {
  const { type, id } = await request.json().catch(() => ({}));
  if (!id || !['webinar', 'task'].includes(type)) return NextResponse.json({ error: 'Invalid type or id' }, { status: 400 });

  if (type === 'webinar') {
    const webinar = await db.webinar.findUnique({ where: { id }, include: { tasks: true } });
    if (!webinar) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (webinar.status === 'archived') return NextResponse.json({ success: true });

    const writes: Prisma.PrismaPromise<unknown>[] = [
      db.settings.upsert({ where: { key: `archive_original_status_webinar_${id}` }, update: { value: webinar.status }, create: { key: `archive_original_status_webinar_${id}`, value: webinar.status } }),
      db.settings.upsert({ where: { key: `archive_mts_webinar_${id}` }, update: { value: JSON.stringify({ completedAt: webinar.completedAt, mtsLinkWebinarId: webinar.mtsLinkWebinarId, mtsLinkEventId: webinar.mtsLinkEventId, mtsLinkEventSessionId: webinar.mtsLinkEventSessionId, mtsLinkUrl: webinar.mtsLinkUrl, mtsLinkLastSyncAt: webinar.mtsLinkLastSyncAt }) }, create: { key: `archive_mts_webinar_${id}`, value: JSON.stringify({ mtsLinkWebinarId: webinar.mtsLinkWebinarId, mtsLinkUrl: webinar.mtsLinkUrl }) } }),
      db.webinar.update({ where: { id }, data: { status: 'archived' } }),
    ];
    await db.$transaction(writes);
    return NextResponse.json({ success: true, archived: webinar.tasks.length });
  }

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (task.status === 'archived') return NextResponse.json({ success: true });
  await db.$transaction([
    db.settings.upsert({ where: { key: `archive_original_status_task_${id}` }, update: { value: JSON.stringify({ status: task.status, completedAt: task.completedAt }) }, create: { key: `archive_original_status_task_${id}`, value: JSON.stringify({ status: task.status, completedAt: task.completedAt }) } }),
    db.task.update({ where: { id }, data: { status: 'archived' } }),
  ]);
  return NextResponse.json({ success: true });
});

export const PUT = withAuth(async (request: Request) => {
  const { type, id } = await request.json().catch(() => ({}));
  if (!id || !['webinar', 'task'].includes(type)) return NextResponse.json({ error: 'Invalid type or id' }, { status: 400 });

  if (type === 'webinar') {
    const current = await db.webinar.findUnique({ where: { id }, include: { tasks: true } });
    if (current?.status === 'archived') {
      const statusRow = await db.settings.findUnique({ where: { key: `archive_original_status_webinar_${id}` } });
      const mtsRow = await db.settings.findUnique({ where: { key: `archive_mts_webinar_${id}` } });
      let mts: { completedAt?: string | null; mtsLinkWebinarId?: string | null; mtsLinkEventId?: string | null; mtsLinkEventSessionId?: string | null; mtsLinkUrl?: string | null; mtsLinkLastSyncAt?: string | null } = {};
      try { mts = mtsRow?.value ? JSON.parse(mtsRow.value) : {}; } catch {}
      const restoredStatus = statusRow?.value || 'planned';
      await db.$transaction([
        db.webinar.update({ where: { id }, data: { status: restoredStatus, completedAt: mts.completedAt ? new Date(mts.completedAt) : undefined, mtsLinkWebinarId: mts.mtsLinkWebinarId ?? undefined, mtsLinkEventId: mts.mtsLinkEventId ?? undefined, mtsLinkEventSessionId: mts.mtsLinkEventSessionId ?? undefined, mtsLinkUrl: mts.mtsLinkUrl ?? undefined, mtsLinkLastSyncAt: mts.mtsLinkLastSyncAt ? new Date(mts.mtsLinkLastSyncAt) : undefined } }),
        db.settings.deleteMany({ where: { key: { in: [`archive_original_status_webinar_${id}`, `archive_mts_webinar_${id}`] } } }),
      ]);
      return NextResponse.json({ success: true, restored: 'live' });
    }

    const archived = await db.archiveWebinar.findUnique({ where: { id } });
    if (!archived) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const collision = await db.webinar.findUnique({ where: { id: archived.originalId }, select: { id: true } });
    if (collision) return NextResponse.json({ error: 'Нельзя восстановить: исходный ID уже занят другим вебинаром' }, { status: 409 });
    const archivedTasks = await db.archiveTask.findMany({ where: { webinarId: archived.originalId } });
    const writes: Prisma.PrismaPromise<unknown>[] = [db.webinar.create({ data: { id: archived.originalId, title: archived.title, description: archived.description, date: archived.date, responsibleId: archived.responsibleId, email: archived.email, status: archived.status, completedAt: archived.completedAt, mtsLinkWebinarId: archived.mtsLinkWebinarId, mtsLinkEventId: archived.mtsLinkEventId, mtsLinkEventSessionId: archived.mtsLinkEventSessionId, mtsLinkUrl: archived.mtsLinkUrl, mtsLinkLastSyncAt: archived.mtsLinkLastSyncAt } })];
    for (const task of archivedTasks) writes.push(db.task.create({ data: { id: task.originalId, title: task.title, webinarId: archived.originalId, responsibleId: task.responsibleId, taskType: task.taskType, dueDate: task.dueDate, status: task.status } }));
    writes.push(db.archiveTask.deleteMany({ where: { webinarId: archived.originalId } }), db.archiveWebinar.delete({ where: { id } }));
    await db.$transaction(writes);
    return NextResponse.json({ success: true });
  }

  const current = await db.task.findUnique({ where: { id } });
  if (current?.status === 'archived') {
    const statusRow = await db.settings.findUnique({ where: { key: `archive_original_status_task_${id}` } });
    let restoredTask: { status?: string; completedAt?: string | null } = {};
    try { restoredTask = statusRow?.value ? JSON.parse(statusRow.value) : { status: statusRow?.value }; } catch { restoredTask = { status: statusRow?.value }; }
    await db.$transaction([
      db.task.update({ where: { id }, data: { status: restoredTask.status || 'done', completedAt: restoredTask.completedAt ? new Date(restoredTask.completedAt) : undefined } }),
      db.settings.delete({ where: { key: `archive_original_status_task_${id}` } }),
    ]);
    return NextResponse.json({ success: true, restored: 'live' });
  }

  const archived = await db.archiveTask.findUnique({ where: { id } });
  if (!archived) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const collision = await db.task.findUnique({ where: { id: archived.originalId }, select: { id: true } });
  if (collision) return NextResponse.json({ error: 'Нельзя восстановить: исходный ID уже занят другой задачей' }, { status: 409 });
  const webinar = archived.webinarId ? await db.webinar.findUnique({ where: { id: archived.webinarId }, select: { id: true } }) : null;
  await db.$transaction([
    db.task.create({ data: { id: archived.originalId, title: archived.title, webinarId: webinar?.id || null, responsibleId: archived.responsibleId, taskType: archived.taskType, dueDate: archived.dueDate, status: archived.status, completedAt: archived.completedAt } }),
    db.archiveTask.delete({ where: { id } }),
  ]);
  return NextResponse.json({ success: true });
});
