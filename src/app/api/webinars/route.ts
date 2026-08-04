import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const webinars = await db.webinar.findMany({
    include: { responsible: true, tasks: true },
    orderBy: { date: 'asc' },
  });
  return NextResponse.json(webinars);
}

export async function POST(request: Request) {
  const data = await request.json();
  const webinar = await db.webinar.create({
    data: {
      title: data.title,
      description: data.description || null,
      date: new Date(data.date),
      responsibleId: data.responsibleId || null,
      email: data.email || null,
      status: data.status || 'planned',
    },
    include: { responsible: true, tasks: true },
  });
  return NextResponse.json(webinar, { status: 201 });
}

export async function PUT(request: Request) {
  const data = await request.json();

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.date) updateData.date = new Date(data.date);
  if (data.responsibleId !== undefined) updateData.responsibleId = data.responsibleId;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.status !== undefined) updateData.status = data.status;

  const webinar = await db.webinar.update({
    where: { id: data.id },
    data: updateData,
    include: { responsible: true, tasks: true },
  });
  return NextResponse.json(webinar);
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

  await db.task.deleteMany({ where: { webinarId: id } });
  await db.webinar.delete({ where: { id } });
  return NextResponse.json({ success: true });
}