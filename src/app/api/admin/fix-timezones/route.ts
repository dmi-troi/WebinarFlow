// Одноразовый скрипт миграции: сдвигает dueDate всех задач на -3 часа,
// исправляя задачи созданные до внедрения msk-time.ts (когда сервер
// парсил '2026-08-06T10:30' как UTC вместо МСК).
// После применения — удалить этот файл.
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST() {

  const tasks = await db.task.findMany({ select: { id: true, dueDate: true, title: true } });
  const results: { id: string; title: string; was: string; now: string }[] = [];

  for (const t of tasks) {
    const old = new Date(t.dueDate);
    const fixed = new Date(old.getTime() - 3 * 60 * 60 * 1000);
    await db.task.update({ where: { id: t.id }, data: { dueDate: fixed } });
    results.push({ id: t.id, title: t.title, was: old.toISOString(), now: fixed.toISOString() });
  }

  return NextResponse.json({ fixed: results.length, results });
}
