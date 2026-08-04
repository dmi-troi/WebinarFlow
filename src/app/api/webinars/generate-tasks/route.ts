import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { webinarId } = await request.json();

  const webinar = await db.webinar.findUnique({ where: { id: webinarId } });
  if (!webinar) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let settings = await db.settings.findMany();
  const settingsMap: Record<string, string> = {};
  for (const s of settings) settingsMap[s.key] = s.value;

  const periods = settingsMap.taskPeriods
    ? JSON.parse(settingsMap.taskPeriods)
    : { unisender: 3, mtsLink: 1, reminder: 1, eventDay: 0 };

  const typeNames = settingsMap.taskTypeNames
    ? JSON.parse(settingsMap.taskTypeNames)
    : { unisender: 'Юнисендер', mtsLink: 'МТС Link', reminder: 'Напоминание', eventDay: 'День мероприятия' };

  // Default reminder times per task type (HH:MM, Moscow time)
  const defaultReminders: Record<string, string> = {
    unisender: '09:00',
    mtsLink: '10:00',
    reminder: '09:30',
    eventDay: '08:00',
  };

  const customReminders = settingsMap.taskReminderTimes
    ? JSON.parse(settingsMap.taskReminderTimes)
    : {};

  const tasks = [];
  const taskDefinitions = [
    { key: 'unisender', type: 'unisender' },
    { key: 'mtsLink', type: 'mtsLink' },
    { key: 'reminder', type: 'reminder' },
    { key: 'eventDay', type: 'eventDay' },
  ];

  for (const def of taskDefinitions) {
    const daysBefore = periods[def.key] ?? 0;
    const dueDate = new Date(webinar.date);
    dueDate.setDate(dueDate.getDate() - daysBefore);

    // reminderTime defaults per type, overridable in Settings
    const reminderTime = customReminders[def.type] || defaultReminders[def.type] || null;

    const task = await db.task.create({
      data: {
        title: `${typeNames[def.type] || def.type}: ${webinar.title}`,
        webinarId: webinar.id,
        responsibleId: webinar.responsibleId,
        taskType: def.type,
        dueDate,
        reminderTime,
        status: 'pending',
      },
    });
    tasks.push(task);
  }

  return NextResponse.json(tasks, { status: 201 });
}
