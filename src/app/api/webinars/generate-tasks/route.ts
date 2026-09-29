import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import { shiftToBusinessDay } from '@/lib/business-days';
import { NextResponse } from 'next/server';

export const POST = withAuth(async (request: Request) => {
  const { webinarId } = await request.json().catch(() => ({}));
  if (!webinarId) return NextResponse.json({ error: 'webinarId required' }, { status: 400 });

  const webinar = await db.webinar.findUnique({ where: { id: webinarId } });
  if (!webinar) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (webinar.status === 'archived') return NextResponse.json({ error: 'Архивный вебинар нельзя планировать' }, { status: 400 });
  if (new Date(webinar.date) < new Date()) return NextResponse.json({ error: 'Вебинар уже прошёл — задачи не создаются' }, { status: 400 });

  const rows = await db.settings.findMany();
  const settings: Record<string, string> = Object.fromEntries(rows.map((s) => [s.key, s.value]));
  let periods: Record<string, number>;
  let typeNames: Record<string, string>;
  try { periods = JSON.parse(settings.taskPeriods || '{}'); } catch { periods = {}; }
  try { typeNames = JSON.parse(settings.taskTypeNames || '{}'); } catch { typeNames = {}; }

  const definitions = [
    { key: 'unisender', type: 'unisender' },
    { key: 'mtsLink', type: 'mtsLink' },
    { key: 'reminder', type: 'reminder' },
    { key: 'eventDay', type: 'eventDay' },
    { key: 'sms', type: 'sms' },
  ];
  const existing = await db.task.findMany({ where: { webinarId: webinar.id }, select: { taskType: true } });
  const existingTypes = new Set(existing.map((task) => task.taskType));
  const toCreate = definitions.filter((definition) => !existingTypes.has(definition.type));
  if (toCreate.length === 0) return NextResponse.json({ error: 'Задачи для этого вебинара уже сгенерированы' }, { status: 409 });

  const holidays = await db.holiday.findMany({ select: { date: true } });
  const direction = settings.taskShiftDirection === 'forward' ? 'forward' : 'back';
  const maxShiftDays = Math.max(1, parseInt(settings.maxShiftDays || '7', 10) || 7);
  const now = new Date();
  const tasks: unknown[] = [];

  for (const definition of toCreate) {
    const daysBefore = Math.max(0, Number(periods[definition.key] ?? 0));
    const dueDate = new Date(webinar.date);
    dueDate.setDate(dueDate.getDate() - daysBefore);
    if (dueDate < now) dueDate.setTime(now.getTime());
    const businessDueDate = shiftToBusinessDay(dueDate, holidays, direction, maxShiftDays);
    tasks.push(await db.task.create({
      data: {
        title: `${typeNames[definition.type] || definition.type}: ${webinar.title}`,
        webinarId: webinar.id,
        responsibleId: webinar.responsibleId,
        taskType: definition.type,
        dueDate: businessDueDate,
        status: 'pending',
      },
    }));
  }

  return NextResponse.json({ tasks, created: tasks.length, skippedExisting: definitions.length - toCreate.length }, { status: 201 });
});
