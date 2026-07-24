import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const holidays = await db.holiday.findMany({ orderBy: { date: 'asc' } });
  return NextResponse.json(holidays);
}

export async function POST(request: Request) {
  const data = await request.json();
  if (Array.isArray(data)) {
    const holidays = await Promise.all(
      data.map((h: { date: string; name: string }) =>
        db.holiday.create({
          data: { date: new Date(h.date), name: h.name },
        })
      )
    );
    return NextResponse.json(holidays, { status: 201 });
  }
  const holiday = await db.holiday.create({
    data: { date: new Date(data.date), name: data.name },
  });
  return NextResponse.json(holiday, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
  await db.holiday.delete({ where: { id } });
  return NextResponse.json({ success: true });
}