import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { withAuth } from '@/lib/auth';

const DEFAULT_BASE_URL = 'https://userapi.mts-link.ru/v3';
const MAX_PAGES = 50;

type AnyMap = Record<string, any>;

async function getSettings() {
  const rows = await db.settings.findMany({
    where: { key: { in: ['mtsLinkApiKey', 'mtsLinkBaseUrl'] } },
  });
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    apiKey: map.mtsLinkApiKey || '',
    baseUrl: (map.mtsLinkBaseUrl || DEFAULT_BASE_URL).replace(/\/+$/, ''),
  };
}

async function mtsFetch(path: string, apiKey: string, baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'GET',
      headers: {
        'x-auth-token': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    const raw = await response.text();
    let data: unknown = raw;
    try { data = JSON.parse(raw); } catch {}
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      data: error instanceof Error ? error.message : 'Network error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function extractArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.items)) return data.data.items;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function extractItems(data: any): { items: any[]; total: number | null; nextCursor?: string | null } {
  if (Array.isArray(data)) return { items: data, total: data.length, nextCursor: null };
  const root = data?.data && typeof data.data === 'object' ? data.data : data;
  return {
    items: Array.isArray(root?.items) ? root.items : Array.isArray(root) ? root : [],
    total: Number.isFinite(Number(root?.total)) ? Number(root.total) : null,
    nextCursor: root?.nextPageCursor || null,
  };
}

function scheduleQuery(perPage: 10 | 50 | 100 | 250, page: number) {
  const from = new Date();
  from.setFullYear(from.getFullYear() - 2);
  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);
  return `/organization/events/schedule?from=${ymd(from)}&to=${ymd(to)}&perPage=${perPage}&page=${page}&status[0]=ACTIVE&status[1]=STOP&status[2]=START`;
}

async function fetchSchedule(apiKey: string, baseUrl: string) {
  const result: any[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await mtsFetch(scheduleQuery(250, page), apiKey, baseUrl);
    if (!response.ok) return { ...response, events: result };
    const items = extractArray(response.data);
    result.push(...items);
    if (items.length < 250) return { ...response, events: result };
  }
  return { ok: true, status: 200, data: result, events: result };
}

function flattenEvents(events: any[]) {
  const result: AnyMap[] = [];
  for (const event of events) {
    const sessions = Array.isArray(event.eventSessions) && event.eventSessions.length ? event.eventSessions : [event];
    for (const session of sessions) {
      const startDate = session.startsAt || event.startsAt || '';
      const endDate = session.endsAt || event.endsAt || '';
      result.push({
        id: String(session.id ?? event.id ?? ''),
        eventId: String(event.id ?? session.eventId ?? ''),
        title: String(event.name || session.name || ''),
        description: String(event.description || session.description || ''),
        startDate,
        endDate,
        status: String(session.status || event.status || ''),
        ownerName: event.createUser ? `${event.createUser.name || ''} ${event.createUser.secondName || ''}`.trim() : '',
        participantCount: Number(session.participationsCount ?? event.participationsCount ?? 0),
        joinUrl: session.link?.url || session.link || event.link?.url || event.link || '',
        recordUrl: session.recordUrl?.url || session.recordUrl || event.recordUrl?.url || event.recordUrl || '',
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

function titleTokens(title: string) {
  return new Set(
    title.toLowerCase()
      .replace(/[^a-zа-я0-9]+/gi, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}

function matchScore(localTitle: string, localDate: string, mts: AnyMap) {
  const a = titleTokens(localTitle);
  const b = titleTokens(String(mts.title || ''));
  const union = new Set([...a, ...b]);
  let common = 0;
  for (const token of a) if (b.has(token)) common += 1;
  const titleScore = union.size ? common / union.size : 0;
  const diffHours = localDate && mts.startDate
    ? Math.abs(new Date(localDate).getTime() - new Date(mts.startDate).getTime()) / 3_600_000
    : Number.POSITIVE_INFINITY;
  let dateScore = 0;
  if (diffHours <= 1) dateScore = 1;
  else if (diffHours <= 3) dateScore = 0.85;
  else if (diffHours <= 12) dateScore = 0.6;
  else if (diffHours <= 48) dateScore = 0.25;
  const score = Math.round((titleScore * 0.7 + dateScore * 0.3) * 100);
  return { score, diffHours };
}

async function loadParticipants(sessionId: string, apiKey: string, baseUrl: string) {
  const participants: any[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await mtsFetch(
      `/eventsessions/${encodeURIComponent(sessionId)}/participations?page=${page}&perPage=500`,
      apiKey,
      baseUrl,
    );
    if (!response.ok) return { ...response, participants };
    const items = extractArray(response.data);
    participants.push(...items);
    if (items.length < 500) return { ...response, participants };
  }
  return { ok: true, status: 200, data: participants, participants };
}

async function loadTranscripts(sessionId: string, apiKey: string, baseUrl: string) {
  const response = await mtsFetch(
    `/eventsessions/${encodeURIComponent(sessionId)}/transcript/list?perPage=1000`,
    apiKey,
    baseUrl,
  );
  return { ...response, transcripts: extractItems(response.data).items };
}

async function loadDetail(sessionId: string, apiKey: string, baseUrl: string) {
  const detail = await mtsFetch(`/eventsessions/${encodeURIComponent(sessionId)}`, apiKey, baseUrl);
  if (!detail.ok) return { ...detail, detail: null, stats: null };
  const from = new Date();
  from.setFullYear(from.getFullYear() - 2);
  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);
  const stats = await mtsFetch(
    `/stats/events?from=${encodeURIComponent(`${ymd(from)}+00:00:00`)}&to=${encodeURIComponent(`${ymd(to)}+23:59:59`)}&eventId=${encodeURIComponent(sessionId)}`,
    apiKey,
    baseUrl,
  );
  return { ok: true, status: detail.status, detail: detail.data, stats: stats.ok ? (extractArray(stats.data)[0] || null) : null };
}

export const GET = withAuth(async (request: Request) => {
  try {
    const params = new URL(request.url).searchParams;
    const action = params.get('action') || 'status';
    const { apiKey, baseUrl } = await getSettings();

    if (!apiKey) {
      return NextResponse.json(
        { configured: false, error: 'API ключ МТС Линк не задан. Настройте его в Настройках.' },
        { status: action === 'status' ? 200 : 400 },
      );
    }

    if (action === 'status') {
      const response = await mtsFetch(scheduleQuery(10, 1), apiKey, baseUrl);
      return NextResponse.json({
        configured: true,
        baseUrl,
        connectionOk: response.ok,
        httpStatus: response.status,
        readOnly: true,
        checkedAt: new Date().toISOString(),
      });
    }

    if (action === 'webinars') {
      const response = await fetchSchedule(apiKey, baseUrl);
      if (!response.ok) return NextResponse.json({ error: `МТС Линк вернул ${response.status}` }, { status: 502 });
      const webinars = flattenEvents(response.events || []);
      return NextResponse.json({
        webinars,
        total: webinars.length,
        source: 'mts-link-read-only',
        syncedAt: new Date().toISOString(),
      });
    }

    if (action === 'match') {
      const title = (params.get('title') || '').trim();
      const date = params.get('date') || '';
      if (!title) return NextResponse.json({ error: 'Укажите title' }, { status: 400 });
      const response = await fetchSchedule(apiKey, baseUrl);
      if (!response.ok) return NextResponse.json({ error: `МТС Линк вернул ${response.status}` }, { status: 502 });
      const candidates = flattenEvents(response.events || [])
        .map((mts) => ({ ...mts, match: matchScore(title, date, mts) }))
        .sort((a, b) => b.match.score - a.match.score || a.match.diffHours - b.match.diffHours)
        .slice(0, 8);
      return NextResponse.json({ candidates, syncedAt: new Date().toISOString() });
    }

    if (action === 'detail') {
      const sessionId = params.get('sessionId') || params.get('id');
      if (!sessionId) return NextResponse.json({ error: 'Укажите sessionId' }, { status: 400 });
      const result = await loadDetail(sessionId, apiKey, baseUrl);
      if (!result.ok) return NextResponse.json({ error: `МТС Линк вернул ${result.status}` }, { status: 502 });
      return NextResponse.json({
        sessionId,
        detail: result.detail,
        stats: result.stats,
        readOnly: true,
        syncedAt: new Date().toISOString(),
      });
    }

    if (action === 'participants') {
      const sessionId = params.get('sessionId') || params.get('id');
      if (!sessionId) return NextResponse.json({ error: 'Укажите sessionId' }, { status: 400 });
      const result = await loadParticipants(sessionId, apiKey, baseUrl);
      if (!result.ok) return NextResponse.json({ error: `МТС Линк вернул ${result.status}` }, { status: 502 });
      const participants = result.participants || [];
      const visited = participants.filter((item) => Boolean(item.visited)).length;
      return NextResponse.json({
        participants,
        total: participants.length,
        registered: participants.length,
        visited,
        visitRate: participants.length ? Math.round((visited / participants.length) * 1000) / 10 : 0,
        syncedAt: new Date().toISOString(),
      });
    }

    if (action === 'transcripts') {
      const sessionId = params.get('sessionId') || params.get('id');
      if (!sessionId) return NextResponse.json({ error: 'Укажите sessionId' }, { status: 400 });
      const result = await loadTranscripts(sessionId, apiKey, baseUrl);
      if (!result.ok) return NextResponse.json({ error: `МТС Линк вернул ${result.status}` }, { status: 502 });
      return NextResponse.json({ transcripts: result.transcripts, syncedAt: new Date().toISOString() });
    }

    if (action === 'transcript') {
      const id = params.get('id');
      if (!id) return NextResponse.json({ error: 'Укажите transcript id' }, { status: 400 });
      const result = await mtsFetch(`/transcript/${encodeURIComponent(id)}`, apiKey, baseUrl);
      if (!result.ok) return NextResponse.json({ error: `МТС Линк вернул ${result.status}` }, { status: 502 });
      return NextResponse.json({ transcript: result.data, syncedAt: new Date().toISOString() });
    }

    if (action === 'files') {
      const sessionId = params.get('sessionId') || params.get('id');
      if (!sessionId) return NextResponse.json({ error: 'Укажите sessionId' }, { status: 400 });
      const result = await mtsFetch(`/eventsessions/${encodeURIComponent(sessionId)}/files`, apiKey, baseUrl);
      if (!result.ok) return NextResponse.json({ error: `МТС Линк вернул ${result.status}` }, { status: 502 });
      return NextResponse.json({ files: extractArray(result.data), syncedAt: new Date().toISOString() });
    }

    if (action === 'questions') {
      const sessionId = params.get('sessionId') || params.get('id');
      if (!sessionId) return NextResponse.json({ error: 'Укажите sessionId' }, { status: 400 });
      const result = await mtsFetch(`/eventsessions/${encodeURIComponent(sessionId)}/questions`, apiKey, baseUrl);
      if (!result.ok) return NextResponse.json({ error: `МТС Линк вернул ${result.status}` }, { status: 502 });
      return NextResponse.json({ questions: extractArray(result.data), syncedAt: new Date().toISOString() });
    }

    if (action === 'chat') {
      const sessionId = params.get('sessionId') || params.get('id');
      if (!sessionId) return NextResponse.json({ error: 'Укажите sessionId' }, { status: 400 });
      const result = await mtsFetch(`/eventsessions/${encodeURIComponent(sessionId)}/chat`, apiKey, baseUrl);
      if (!result.ok) return NextResponse.json({ error: `МТС Линк вернул ${result.status}` }, { status: 502 });
      return NextResponse.json({ messages: extractArray(result.data), syncedAt: new Date().toISOString() });
    }

    if (action === 'attention') {
      const sessionId = params.get('sessionId') || params.get('id');
      if (!sessionId) return NextResponse.json({ error: 'Укажите sessionId' }, { status: 400 });
      const result = await mtsFetch(
        `/eventsessions/${encodeURIComponent(sessionId)}/attention-control/interactions?page=1&perPage=500`,
        apiKey,
        baseUrl,
      );
      if (!result.ok) return NextResponse.json({ error: `МТС Линк вернул ${result.status}` }, { status: 502 });
      const parsed = extractItems(result.data);
      return NextResponse.json({ interactions: parsed.items, total: parsed.total ?? parsed.items.length, syncedAt: new Date().toISOString() });
    }

    return NextResponse.json({ error: 'Неизвестное действие' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown' }, { status: 500 });
  }
});
