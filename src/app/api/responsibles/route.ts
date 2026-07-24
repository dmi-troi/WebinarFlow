import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const responsibles = await db.responsible.findMany({
    include: { _count: { select: { webinars: true, tasks: true } } },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(responsibles);
}

export async function POST(request: Request) {
  const data = await request.json();
  const responsible = await db.responsible.create({
    data: {
      name: data.name,
      email: data.email || null,
      telegram: data.telegram || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
    include: { _count: { select: { webinars: true, tasks: true } } },
  });
  return NextResponse.json(responsible, { status: 201 });
}

export async function PUT(request: Request) {
  const data = await request.json();
  const responsible = await db.responsible.update({
    where: { id: data.id },
    data: {
      name: data.name,
      email: data.email !== undefined ? data.email : undefined,
      telegram: data.telegram !== undefined ? data.telegram : undefined,
      isActive: data.isActive !== undefined ? data.isActive : undefined,
    },
    include: { _count: { select: { webinars: true, tasks: true } } },
  });
  return NextResponse.json(responsible);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await db.task.updateMany({ where: { responsibleId: id }, data: { responsibleId: null } });
  await db.webinar.updateMany({ where: { responsibleId: id }, data: { responsibleId: null } });
  await db.responsible.delete({ where: { id } });
  return NextResponse.json({ success: true });
}