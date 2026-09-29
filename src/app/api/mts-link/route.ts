import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';

async function getSettings() {
  const rows = await db.settings.findMany({ where: { key: { in: ['mtsLinkApiKey', 'mtsLinkBaseUrl'] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { apiKey: map.mtsLinkApiKey || '', baseUrl: (map.mtsLinkBaseUrl || 'https://userapi.mts-link.ru/v3').replace(/\/+$/, '') };
}

async function mtsFetch(path: string, apiKey: string, baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, { headers: { 'x-auth-token': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }, signal: controller.signal, cache: 'no-store' });
    const body = await response.text();
    let data: unknown = body;
    try { data = JSON.parse(body); } catch {}
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 502, data: error instanceof Error ? error.message : 'Network error' };
  } finally { clearTimeout(timeout); }
}

function ymd(d: Date) { return d.toISOString().slice(0, 10); }
function scheduleQuery(perPage: 10 | 50 | 100 | 250, page: number, statuses: string[] = ['ACTIVE', 'STOP', 'START']) {
  const from = new Date(); from.setFullYear(from.getFullYear() - 1);
  const to = new Date(); to.setFullYear(to.getFullYear() + 1);
  const statusParams = statuses.map((status, index) => `status[${index}]=${encodeURIComponent(status)}`).join('&');
  return `/organization/events/schedule?from=${ymd(from)}&to=${ymd(to)}&perPage=${perPage}&page=${page}&${statusParams}`;
}

function extractEvents(data: any): any[] { return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.data?.items) ? data.data.items : []; }

async function fetchAllSchedule(apiKey: string, baseUrl: string, statuses?: string[]) {
  const result: any[] = [];
  const perPage = 250;
  for (let page = 1; page <= 20; page += 1) {
    const response = await mtsFetch(scheduleQuery(perPage, page, statuses), apiKey, baseUrl);
    if (!response.ok) return { ...response, events: result };
    const items = extractEvents(response.data);
    result.push(...items);
    if (items.length < perPage) return { ...response, events: result };
  }
  return { ok: true, status: 200, data: result, events: result };
}

function flattenEvents(events: any[]) {
  const result: any[] = [];
  for (const event of events) {
    const sessions = Array.isArray(event.eventSessions) && event.eventSessions.length ? event.eventSessions : [event];
    for (const session of sessions) {
      result.push({
        id: String(session.id ?? event.id ?? ''),
        eventId: String(event.id ?? ''),
        title: event.name || session.name || '',
        description: event.description || session.description || '',
        startDate: session.startsAt || event.startsAt || '',
        endDate: session.endsAt || event.endsAt || '',
        status: session.status || event.status || '',
        ownerName: event.createUser ? `${event.createUser.name || ''} ${event.createUser.secondName || ''}`.trim() : '',
        participantCount: Number(session.participationsCount ?? 0),
        joinUrl: session.link?.url || session.link || event.link?.url || event.link || '',
        recordUrl: session.recordUrl?.url || '',
        isArchive: Boolean(session.isArchive ?? event.isArchive ?? false),
        sessionType: session.type || event.type || '',
        timezoneName: session.timezoneName || event.timezoneName || '',
        timezone: session.timezone || event.timezone || '',
        durationSeconds: Number(session.duration ?? event.duration ?? 0) || 0,
        lectorsCount: Array.isArray(event.lectors) ? event.lectors.length : 0,
        tagsCount: Array.isArray(event.tags) ? event.tags.length : 0,
        filesCount: Array.isArray(event.files) ? event.files.length : 0,
      });
    }
  }
  return result;
}

export const GET = withAuth(async (request: Request) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    const action = searchParams.get('action') || 'status';
    const { apiKey, baseUrl } = await getSettings();
    if (!apiKey) return NextResponse.json({ configured: false, error: 'API ключ не задан. Настройте в Настройках.' }, { status: action === 'status' ? 200 : 400 });

    if (action === 'status') {
      const response = await mtsFetch(scheduleQuery(10, 1), apiKey, baseUrl);
      return NextResponse.json({ configured: true, baseUrl, connectionOk: response.ok, httpStatus: response.status });
    }

    if (action === 'webinars') {
      const response = await fetchAllSchedule(apiKey, baseUrl);
      if (!response.ok) return NextResponse.json({ error: `МТС Линк вернул ${response.status}`, details: response.data }, { status: 502 });
      const normalized = flattenEvents(response.events || []);
      return NextResponse.json({ webinars: normalized, total: normalized.length, source: 'mts-link-read-only' });
    }

    if (action === 'webinar') {
      const id = searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'Укажите id' }, { status: 400 });
      const response = await mtsFetch(`/organization/events/${encodeURIComponent(id)}`, apiKey, baseUrl);
      if (!response.ok) return NextResponse.json({ error: `МТС Линк вернул ${response.status}`, details: response.data }, { status: 502 });
      return NextResponse.json(flattenEvents([response.data])[0] || {});
    }

    if (action === 'stats') {
      const from = new Date(); from.setFullYear(from.getFullYear() - 1);
      const statsResponse = await mtsFetch(`/stats/events?from=${encodeURIComponent(`${ymd(from)}+00:00:00`)}`, apiKey, baseUrl);
      const past = extractEvents(statsResponse.data);
      const upcomingResponse = await fetchAllSchedule(apiKey, baseUrl, ['ACTIVE']);
      if (!statsResponse.ok && !upcomingResponse.ok) return NextResponse.json({ error: 'Не удалось получить данные МТС Линк' }, { status: 502 });
      const upcoming = upcomingResponse.ok ? flattenEvents(upcomingResponse.events || []) : [];
      const totalParticipants = past.reduce((sum, event) => sum + Number(event.registeredVisitedCount || 0), 0);
      const recordingsCount = past.reduce((sum, event) => sum + Number(event.recordingsCount ?? event.recordingCount ?? (event.recordUrl ? 1 : 0)), 0);
      const completedWebinars = past.length;
      return NextResponse.json({ totalWebinars: completedWebinars + upcoming.length, completedWebinars, upcomingWebinars: upcoming.length, totalParticipants, avgParticipants: completedWebinars ? Math.round(totalParticipants / completedWebinars) : 0, recordingsCount });
    }
    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 }); }
});

