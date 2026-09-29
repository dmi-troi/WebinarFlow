import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';
export const GET = withAuth(async () => NextResponse.json(await db.holiday.findMany({ orderBy: { date: 'asc' } })));
export const POST = withAuth(async (request: Request) => {
  const data = await request.json().catch(() => ({}));
  if (Array.isArray(data)) {
    const rows = data.filter((h) => h?.date && h?.name).map((h) => ({ date: new Date(h.date), name: String(h.name) }));
    if (rows.some((h) => Number.isNaN(h.date.getTime()))) return NextResponse.json({ error: 'Некорректная дата праздника' }, { status: 400 });
    return NextResponse.json(await db.holiday.createMany({ data: rows }), { status: 201 });
  }
  const date = new Date(data.date);
  if (!data.name || Number.isNaN(date.getTime())) return NextResponse.json({ error: 'Дата и название обязательны' }, { status: 400 });
  return NextResponse.json(await db.holiday.create({ data: { date, name: String(data.name) } }), { status: 201 });
});
export const DELETE = withAuth(async (request: Request) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  await db.holiday.delete({ where: { id } });
  return NextResponse.json({ success: true });
});
