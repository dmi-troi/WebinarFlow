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
  const webinar = await db.webinar.update({
    where: { id: data.id },
    data: {
      title: data.title,
      description: data.description !== undefined ? data.description : undefined,
      date: data.date ? new Date(data.date) : undefined,
      responsibleId: data.responsibleId !== undefined ? data.responsibleId : undefined,
      email: data.email !== undefined ? data.email : undefined,
      status: data.status !== undefined ? data.status : undefined,
    },
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