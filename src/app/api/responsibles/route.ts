import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const GET = withAuth(async () => NextResponse.json(await db.responsible.findMany({ include: { _count: { select: { webinars: true, tasks: true } } }, orderBy: { name: 'asc' } })));
export const POST = withAuth(async (request: Request) => {
  const data = await request.json().catch(() => ({}));
  if (!data.name) return NextResponse.json({ error: 'Имя обязательно' }, { status: 400 });
  return NextResponse.json(await db.responsible.create({ data: { name: String(data.name).trim(), email: data.email || null, telegram: data.telegram || null, isActive: data.isActive !== undefined ? Boolean(data.isActive) : true }, include: { _count: { select: { webinars: true, tasks: true } } } }), { status: 201 });
});
export const PUT = withAuth(async (request: Request) => {
  const data = await request.json().catch(() => ({}));
  if (!data.id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  return NextResponse.json(await db.responsible.update({ where: { id: data.id }, data: { name: data.name !== undefined ? String(data.name).trim() : undefined, email: data.email !== undefined ? data.email : undefined, telegram: data.telegram !== undefined ? data.telegram : undefined, isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined }, include: { _count: { select: { webinars: true, tasks: true } } } }));
});
export const DELETE = withAuth(async (request: Request) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  await db.$transaction([
    db.task.updateMany({ where: { responsibleId: id }, data: { responsibleId: null } }),
    db.webinar.updateMany({ where: { responsibleId: id }, data: { responsibleId: null } }),
    db.responsible.delete({ where: { id } }),
  ]);
  return NextResponse.json({ success: true });
});
