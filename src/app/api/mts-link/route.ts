import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getSettings() {
  const keys = ['mtsLinkApiKey', 'mtsLinkBaseUrl'];
  const rows = await prisma.settings.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  rows.forEach((r) => (map[r.key] = r.value));
  return {
    apiKey: map.mtsLinkApiKey || '',
    baseUrl: (map.mtsLinkBaseUrl || 'https://webinar.mts-link.ru/api/v1').replace(/\/+$/, ''),
  };
}

async function mtsFetch(path: string, apiKey: string, baseUrl: string) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

// GET /api/mts-link?action=status|webinars|webinar|stats
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'status';
    const { apiKey, baseUrl } = await getSettings();

    if (action === 'status') {
      if (!apiKey) return NextResponse.json({ configured: false, message: 'API ключ не задан' });
      try {
        const { ok, status } = await mtsFetch('/webinars?limit=1', apiKey, baseUrl);
        return NextResponse.json({ configured: true, baseUrl, connectionOk: ok, httpStatus: status });
      } catch (e: any) {
        return NextResponse.json({ configured: true, connectionOk: false, error: e.message });
      }
    }

    if (!apiKey) return NextResponse.json({ error: 'API ключ не задан. Настройте в Настройках.' }, { status: 400 });

    if (action === 'webinars') {
      const { ok, status, data } = await mtsFetch('/webinars?limit=50', apiKey, baseUrl);
      if (!ok) return NextResponse.json({ error: `MTS Link вернул ${status}`, details: data }, { status: 502 });

      const list = Array.isArray(data) ? data : data?.data || data?.webinars || [];
      const normalized = (Array.isArray(list) ? list : []).map((w: any) => ({
        id: String(w.id || w.webinarId || ''),
        title: w.title || w.name || '',
        startDate: w.startDate || w.startDateTime || w.startTime || '',
        endDate: w.endDate || w.endDateTime || w.endTime || '',
        status: w.status || '',
        description: w.description || '',
        ownerName: w.ownerName || w.owner || '',
        participantCount: w.participantCount || w.participantsCount || w.membersCount || 0,
        maxParticipants: w.maxParticipants || 0,
        recordUrl: w.recordUrl || w.recordFileUrl || '',
        joinUrl: w.joinUrl || w.link || '',
      }));

      return NextResponse.json({ webinars: normalized, total: normalized.length });
    }

    if (action === 'webinar') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Укажите id' }, { status: 400 });
      const { ok, status, data: w } = await mtsFetch(`/webinars/${id}`, apiKey, baseUrl);
      if (!ok) return NextResponse.json({ error: `MTS Link вернул ${status}`, details: w }, { status: 502 });
      return NextResponse.json({
        id: String(w.id || w.webinarId || ''),
        title: w.title || w.name || '',
        startDate: w.startDate || w.startDateTime || '',
        endDate: w.endDate || w.endDateTime || '',
        status: w.status || '',
        description: w.description || '',
        ownerName: w.ownerName || w.owner || '',
        participantCount: w.participantCount || w.participantsCount || w.membersCount || 0,
        maxParticipants: w.maxParticipants || 0,
        recordUrl: w.recordUrl || w.recordFileUrl || '',
        joinUrl: w.joinUrl || w.link || '',
      });
    }

    if (action === 'stats') {
      const { ok, data } = await mtsFetch('/webinars?limit=100', apiKey, baseUrl);
      if (!ok) return NextResponse.json({ error: 'Не удалось получить данные' }, { status: 502 });
      const list = Array.isArray(data) ? data : data?.data || data?.webinars || [];
      const webinars = Array.isArray(list) ? list : [];
      const now = new Date();
      const totalWebinars = webinars.length;
      const completed = webinars.filter((w: any) => {
        const s = (w.status || '').toLowerCase();
        return s === 'completed' || s === 'finished' || s === 'ended';
      });
      const totalParticipants = webinars.reduce((sum: number, w: any) =>
        sum + (w.participantCount || w.participantsCount || w.membersCount || 0), 0
      );
      const withRecording = webinars.filter((w: any) => w.recordUrl || w.recordFileUrl).length;
      const upcoming = webinars.filter((w: any) => {
        const start = new Date(w.startDate || w.startDateTime || 0);
        return start > now;
      });
      return NextResponse.json({
        totalWebinars,
        completedWebinars: completed.length,
        upcomingWebinars: upcoming.length,
        totalParticipants,
        avgParticipants: totalWebinars > 0 ? Math.round(totalParticipants / totalWebinars) : 0,
        recordingsCount: withRecording,
      });
    }

    return NextResponse.json({ error: 'Неизвестное действие. Используйте: status, webinars, webinar, stats' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
