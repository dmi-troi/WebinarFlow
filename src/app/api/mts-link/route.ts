import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

async function getSettings() {
  const keys = ['mtsLinkApiKey', 'mtsLinkBaseUrl'];
  const rows = await db.settings.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  rows.forEach((r) => (map[r.key] = r.value));
  return {
    apiKey: map.mtsLinkApiKey || '',
    baseUrl: (map.mtsLinkBaseUrl || 'https://userapi.mts-link.ru/v3').replace(/\/+$/, ''),
  };
}

// Заголовки строго по официальной документации МТС Линк:
// https://help.mts-link.ru/article/19680 — x-auth-token + x-www-form-urlencoded
async function mtsFetch(path: string, apiKey: string, baseUrl: string) {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        'x-auth-token': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: controller.signal,
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    console.log(`[mts-link] ${url} -> ${res.status} in ${Date.now() - started}ms`);
    if (!res.ok) console.error(`[mts-link] error body:`, text.slice(0, 1000));
    return { ok: res.ok, status: res.status, data };
  } catch (e: any) {
    console.error(`[mts-link] ${url} FAILED after ${Date.now() - started}ms:`, e.name, e.message);
    if (e.name === 'AbortError') {
      return { ok: false, status: 504, data: 'МТС Линк не отвечает (таймаут 15с).' };
    }
    return { ok: false, status: 502, data: `Сетевая ошибка: ${e.message}` };
  } finally {
    clearTimeout(timeout);
  }
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

// GET /organization/events/schedule — вебинары "сериями" (Event), каждая серия
// содержит одну или несколько eventSessions — это и есть реальные проведения.
// Без параметра status[] по умолчанию отдаются только ACTIVE (запланированные) —
// поэтому явно запрашиваем все три статуса, как в примере документации.
function scheduleQuery(perPage: 10 | 50 | 100 | 250, opts: { statuses?: string[] } = {}) {
  const from = new Date();
  from.setFullYear(from.getFullYear() - 1);
  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);
  const statuses = opts.statuses ?? ['ACTIVE', 'STOP', 'START'];
  const statusParams = statuses.map((s, i) => `status[${i}]=${s}`).join('&');
  return `/organization/events/schedule?from=${ymd(from)}&to=${ymd(to)}&perPage=${perPage}&page=1&${statusParams}`;
}

// Разворачивает Event -> eventSessions в плоский список "вебинаров"
function flattenEvents(events: any[]) {
  const result: any[] = [];
  for (const ev of events || []) {
    const sessions = Array.isArray(ev.eventSessions) && ev.eventSessions.length > 0 ? ev.eventSessions : [ev];
    for (const s of sessions) {
      result.push({
        id: String(s.id ?? ev.id ?? ''),
        eventId: String(ev.id ?? ''),
        title: ev.name || s.name || '',
        startDate: s.startsAt || ev.startsAt || '',
        endDate: s.endsAt || ev.endsAt || '',
        status: s.status || ev.status || '',
        ownerName: ev.createUser ? `${ev.createUser.name || ''} ${ev.createUser.secondName || ''}`.trim() : '',
        participantCount: Number(s.participationsCount ?? 0),
        recordUrl: s.recordUrl?.url || '',
      });
    }
  }
  return result;
}

// GET /api/mts-link?action=status|webinars|webinar|stats
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'status';
    const { apiKey, baseUrl } = await getSettings();

    if (action === 'status') {
      if (!apiKey) return NextResponse.json({ configured: false, message: 'API ключ не задан' });
      const { ok, status } = await mtsFetch(scheduleQuery(10), apiKey, baseUrl);
      return NextResponse.json({ configured: true, baseUrl, connectionOk: ok, httpStatus: status });
    }

    if (!apiKey) return NextResponse.json({ error: 'API ключ не задан. Настройте в Настройках.' }, { status: 400 });

    if (action === 'webinars') {
      const { ok, status, data } = await mtsFetch(scheduleQuery(50), apiKey, baseUrl);
      if (!ok) return NextResponse.json({ error: `MTS Link вернул ${status}`, details: data }, { status: 502 });

      const events = Array.isArray(data) ? data : data?.data || [];
      const normalized = flattenEvents(events);
      return NextResponse.json({ webinars: normalized, total: normalized.length });
    }

    if (action === 'webinar') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Укажите id' }, { status: 400 });
      const { ok, status, data: ev } = await mtsFetch(`/organization/events/${id}`, apiKey, baseUrl);
      if (!ok) return NextResponse.json({ error: `MTS Link вернул ${status}`, details: ev }, { status: 502 });
      const [flat] = flattenEvents([ev]);
      return NextResponse.json(flat || {});
    }

    if (action === 'stats') {
      // GET /stats/events — специальный метод статистики: сразу отдаёт
      // прошедшие мероприятия с готовыми агрегатами по участникам.
      const from = new Date();
      from.setFullYear(from.getFullYear() - 1);
      const statsPath = `/stats/events?from=${ymd(from)}+00:00:00`;
      const { ok: statsOk, data: statsData } = await mtsFetch(statsPath, apiKey, baseUrl);
      const pastEvents = statsOk && Array.isArray(statsData) ? statsData : [];

      // Отдельно — только запланированные (ACTIVE), чтобы посчитать "предстоящие"
      const { ok: upcomingOk, data: upcomingData } = await mtsFetch(
        scheduleQuery(250, { statuses: ['ACTIVE'] }),
        apiKey,
        baseUrl
      );
      const upcomingEvents = upcomingOk
        ? flattenEvents(Array.isArray(upcomingData) ? upcomingData : upcomingData?.data || [])
        : [];

      if (!statsOk && !upcomingOk) {
        return NextResponse.json({ error: 'Не удалось получить данные', details: statsData }, { status: 502 });
      }

      const totalParticipants = pastEvents.reduce((sum: number, e: any) => sum + Number(e.registeredVisitedCount || 0), 0);
      const completedWebinars = pastEvents.length;
      const upcomingWebinars = upcomingEvents.length;

      return NextResponse.json({
        totalWebinars: completedWebinars + upcomingWebinars,
        completedWebinars,
        upcomingWebinars,
        totalParticipants,
        avgParticipants: completedWebinars > 0 ? Math.round(totalParticipants / completedWebinars) : 0,
        recordingsCount: 0,
      });
    }

    return NextResponse.json({ error: 'Неизвестное действие. Используйте: status, webinars, webinar, stats' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
