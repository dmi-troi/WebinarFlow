import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const [archivedWebinars, archivedTasks] = await Promise.all([
    db.archiveWebinar.findMany({ orderBy: { archivedAt: 'desc' } }),
    db.archiveTask.findMany({ orderBy: { archivedAt: 'desc' } }),
  ]);
  return NextResponse.json({ webinars: archivedWebinars, tasks: archivedTasks });
}

export async function POST(request: Request) {
  const { type, id } = await request.json();

  if (type === 'webinar') {
    const webinar = await db.webinar.findUnique({
      where: { id },
      include: { tasks: true },
    });
    if (!webinar) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.archiveWebinar.create({
      data: {
        originalId: webinar.id,
        title: webinar.title,
        description: webinar.description,
        date: webinar.date,
        responsibleId: webinar.responsibleId,
        email: webinar.email,
        status: webinar.status,
      },
    });

    for (const task of webinar.tasks) {
      await db.archiveTask.create({
        data: {
          originalId: task.id,
          title: task.title,
          webinarId: task.webinarId,
          responsibleId: task.responsibleId,
          taskType: task.taskType,
          dueDate: task.dueDate,
          reminderTime: task.reminderTime,
          status: task.status,
        },
      });
    }

    await db.task.deleteMany({ where: { webinarId: id } });
    await db.webinar.delete({ where: { id } });
  } else if (type === 'task') {
    const task = await db.task.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.archiveTask.create({
      data: {
        originalId: task.id,
        title: task.title,
        webinarId: task.webinarId,
        responsibleId: task.responsibleId,
        taskType: task.taskType,
        dueDate: task.dueDate,
        reminderTime: task.reminderTime,
        status: task.status,
      },
    });

    await db.task.delete({ where: { id } });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const { type, id } = await request.json();

  if (type === 'webinar') {
    const archived = await db.archiveWebinar.findUnique({ where: { id } });
    if (!archived) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const webinar = await db.webinar.create({
      data: {
        title: archived.title,
        description: archived.description,
        date: archived.date,
        responsibleId: archived.responsibleId,
        email: archived.email,
        status: archived.status,
      },
    });

    await db.archiveWebinar.delete({ where: { id } });
    return NextResponse.json(webinar);
  } else if (type === 'task') {
    const archived = await db.archiveTask.findUnique({ where: { id } });
    if (!archived) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const task = await db.task.create({
      data: {
        title: archived.title,
        webinarId: archived.webinarId,
        responsibleId: archived.responsibleId,
        taskType: archived.taskType,
        dueDate: archived.dueDate,
        reminderTime: archived.reminderTime,
        status: archived.status,
      },
    });

    await db.archiveTask.delete({ where: { id } });
    return NextResponse.json(task);
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}