import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { webinarId } = await request.json();

  const webinar = await db.webinar.findUnique({ where: { id: webinarId } });
  if (!webinar) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const now = new Date();
  if (new Date(webinar.date) < now) {
    return NextResponse.json(
      { error: 'Вебинар уже прошёл — задачи не создаются' },
      { status: 400 }
    );
  }

  let settings = await db.settings.findMany();
  const settingsMap: Record<string, string> = {};
  for (const s of settings) settingsMap[s.key] = s.value;

  const periods = settingsMap.taskPeriods
    ? JSON.parse(settingsMap.taskPeriods)
    : { unisender: 3, mtsLink: 1, reminder: 1, eventDay: 0 };

  const typeNames = settingsMap.taskTypeNames
    ? JSON.parse(settingsMap.taskTypeNames)
    : { unisender: 'Юнисендер', mtsLink: 'МТС Link', reminder: 'Напоминание', eventDay: 'День мероприятия' };

  const taskDefinitions = [
    { key: 'unisender', type: 'unisender' },
    { key: 'mtsLink', type: 'mtsLink' },
    { key: 'reminder', type: 'reminder' },
    { key: 'eventDay', type: 'eventDay' },
  ];

  // Защита от повторной генерации: не создаём задачу того типа,
  // который уже существует для этого вебинара.
  const existing = await db.task.findMany({
    where: { webinarId: webinar.id },
    select: { taskType: true },
  });
  const existingTypes = new Set(existing.map((t) => t.taskType));

  const toCreate = taskDefinitions.filter((def) => !existingTypes.has(def.type));

  if (toCreate.length === 0) {
    return NextResponse.json(
      { error: 'Задачи для этого вебинара уже сгенерированы' },
      { status: 409 }
    );
  }

  const tasks: Record<string, unknown>[] = [];
  for (const def of toCreate) {
    const daysBefore = periods[def.key] ?? 0;
    const dueDate = new Date(webinar.date);
    dueDate.setDate(dueDate.getDate() - daysBefore);

    // Если расчётная дата всё равно оказалась в прошлом (например,
    // вебинар уже завтра, а период "за 3 дня") — не создаём задачу
    // задним числом, ставим на "сейчас".
    if (dueDate < now) dueDate.setTime(now.getTime());

    const task = await db.task.create({
      data: {
        title: `${typeNames[def.type] || def.type}: ${webinar.title}`,
        webinarId: webinar.id,
        responsibleId: webinar.responsibleId,
        taskType: def.type,
        dueDate,
        status: 'pending',
      },
    });
    tasks.push(task as unknown as Record<string, unknown>);
  }

  const skipped = taskDefinitions.length - toCreate.length;
  return NextResponse.json(
    { tasks, created: tasks.length, skippedExisting: skipped },
    { status: 201 }
  );
}
