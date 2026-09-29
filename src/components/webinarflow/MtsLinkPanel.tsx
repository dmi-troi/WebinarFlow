'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CheckCircle2, ExternalLink, FileText, Link2, Loader2, RefreshCw,
  Search, Users, Video, XCircle,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { toast } from 'sonner';
import type { Webinar } from '@/lib/types';

const MSK = 'Europe/Moscow';

type MtsCandidate = {
  id: string;
  eventId: string;
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  joinUrl?: string;
  recordUrl?: string;
  participantCount?: number;
  ownerName?: string;
  match?: { score: number; diffHours: number };
};

type MtsDetailData = {
  id?: string;
  name?: string;
  description?: string;
  status?: string;
  startsAt?: string;
  endsAt?: string;
  createUser?: { name?: string; secondName?: string; email?: string };
  accessSettings?: { isPasswordRequired?: boolean; isRegistrationRequired?: boolean; isModerationRequired?: boolean };
  type?: string;
  lectors?: unknown[];
  tags?: unknown[];
  files?: unknown[];
  eventSessions?: unknown[];
  [key: string]: any;
};

type MtsStatsData = {
  id?: string;
  name?: string;
  startsAt?: string;
  endsAt?: string;
  duration?: number;
  invitedCount?: number;
  invitedVisitedCount?: number;
  registeredCount?: number;
  registeredVisitedCount?: number;
  attendance?: Record<string, number>;
  platform?: Record<string, number>;
  referrer?: Record<string, number>;
  [key: string]: any;
};

type Participant = {
  id?: string | number;
  name?: string;
  secondName?: string;
  email?: string;
  role?: string;
  registerStatus?: string;
  paymentStatus?: string;
  visited?: boolean;
  isOnline?: string | number;
};

type Transcript = {
  id: string | number;
  status?: string;
  createdAt?: string;
};

function fmtDate(value?: string) {
  if (!value) return '—';
  try { return formatInTimeZone(value, MSK, 'd MMM yyyy, HH:mm'); } catch { return value; }
}

function durationMinutes(seconds?: number) {
  if (!seconds) return '—';
  return Math.max(1, Math.round(seconds / 60));
}

export function MtsLinkPanel({ webinar, onLinked }: { webinar: Webinar; onLinked?: () => void }) {
  const sessionId = webinar.mtsLinkEventSessionId || webinar.mtsLinkWebinarId || '';
  const [detail, setDetail] = useState<MtsDetailData | null>(null);
  const [stats, setStats] = useState<MtsStatsData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [candidates, setCandidates] = useState<MtsCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [transcriptsLoading, setTranscriptsLoading] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showTranscripts, setShowTranscripts] = useState(false);
  const [error, setError] = useState('');

  const loadDetail = async () => {
    if (!sessionId) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/mts-link?action=detail&sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось получить данные МТС Линк');
      setDetail(data.detail || null);
      setStats(data.stats || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки МТС Линк');
    } finally {
      setLoading(false);
    }
  };

  const findMatches = async () => {
    setMatching(true);
    setError('');
    try {
      const query = new URLSearchParams({
        action: 'match',
        title: webinar.title,
        date: webinar.date,
      });
      const response = await fetch(`/api/mts-link?${query.toString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось найти мероприятие');
      setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setShowCandidates(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка поиска в МТС Линк');
    } finally {
      setMatching(false);
    }
  };

  const linkCandidate = async (candidate: MtsCandidate) => {
    try {
      const response = await fetch('/api/webinars', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: webinar.id,
          mtsLinkWebinarId: candidate.id,
          mtsLinkEventId: candidate.eventId || null,
          mtsLinkEventSessionId: candidate.id,
          mtsLinkUrl: candidate.joinUrl || candidate.recordUrl || null,
          mtsLinkLastSyncAt: new Date().toISOString(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Не удалось сохранить связь');
      toast.success('Мероприятие связано с МТС Линк');
      setShowCandidates(false);
      onLinked?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка связывания');
    }
  };

  const loadParticipants = async () => {
    if (!sessionId) return;
    setParticipantsLoading(true);
    try {
      const response = await fetch(`/api/mts-link?action=participants&sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить участников');
      setParticipants(Array.isArray(data.participants) ? data.participants : []);
      setShowParticipants(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка участников');
    } finally {
      setParticipantsLoading(false);
    }
  };

  const loadTranscripts = async () => {
    if (!sessionId) return;
    setTranscriptsLoading(true);
    try {
      const response = await fetch(`/api/mts-link?action=transcripts&sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить расшифровки');
      setTranscripts(Array.isArray(data.transcripts) ? data.transcripts : []);
      setShowTranscripts(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка расшифровок');
    } finally {
      setTranscriptsLoading(false);
    }
  };

  useEffect(() => {
    setDetail(null);
    setStats(null);
    setParticipants([]);
    setTranscripts([]);
    setError('');
    setShowCandidates(false);
    if (sessionId) loadDetail();
  }, [sessionId]);

  const visited = stats?.registeredVisitedCount ?? participants.filter((p) => p.visited).length;
  const registered = stats?.registeredCount ?? participants.length;
  const visitRate = registered ? Math.round((visited / registered) * 1000) / 10 : 0;
  const owner = detail?.createUser
    ? [detail.createUser.name, detail.createUser.secondName].filter(Boolean).join(' ')
    : '';

  const recordLinks = useMemo(() => {
    const links: { label: string; url: string }[] = [];
    const direct = (detail?.recordUrl || detail?.record?.url || detail?.record?.downloadUrl) as string | undefined;
    if (direct) links.push({ label: 'Открыть запись', url: direct });
    if (webinar.mtsLinkUrl && !links.some((x) => x.url === webinar.mtsLinkUrl)) links.push({ label: 'Ссылка на МТС Линк', url: webinar.mtsLinkUrl });
    return links;
  }, [detail, webinar.mtsLinkUrl]);

  return (
    <Card className="border-rose-200/70 bg-rose-50/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="font-bold text-[#E30611]">MTS</span>
              <span>Линк</span>
              <Badge variant="outline" className="text-[10px]">только чтение</Badge>
            </CardTitle>
            <p className="mt-1 text-xs text-slate-500">
              МТС Линк используется как источник данных. WebinarFlow не создаёт и не изменяет объекты там.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {sessionId ? (
              <>
                <Button variant="outline" size="sm" onClick={loadDetail} disabled={loading}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Обновить
                </Button>
                {webinar.mtsLinkUrl && (
                  <a href={webinar.mtsLinkUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> МТС Линк</Button>
                  </a>
                )}
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={findMatches} disabled={matching}>
                {matching ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Search className="h-3.5 w-3.5 mr-1.5" />}
                Найти мероприятие
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!sessionId && showCandidates && (
          <div className="space-y-2 rounded-xl border bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium text-slate-900">Найденные совпадения</div>
              <Button variant="ghost" size="sm" onClick={() => setShowCandidates(false)}>Скрыть</Button>
            </div>
            {candidates.length ? candidates.map((candidate) => (
              <div key={candidate.id} className="rounded-xl border p-3 flex flex-col md:flex-row md:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{candidate.title || 'Без названия'}</div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{fmtDate(candidate.startDate)}</span>
                    {candidate.ownerName && <span>{candidate.ownerName}</span>}
                    {candidate.match && <span>Совпадение: {candidate.match.score}%</span>}
                  </div>
                </div>
                <Button size="sm" className="bg-[#1E5BEB] hover:bg-[#1749bb]" onClick={() => linkCandidate(candidate)}>
                  <Link2 className="h-3.5 w-3.5 mr-1.5" /> Связать
                </Button>
              </div>
            )) : (
              <div className="py-5 text-sm text-slate-500 text-center">Совпадений не найдено.</div>
            )}
          </div>
        )}

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 flex gap-2"><XCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}</div>}

        {sessionId && (
          <>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white border p-3"><Video className="h-4 w-4 text-[#1E5BEB]" /><div className="mt-2 text-lg font-bold">{stats?.registeredCount ?? '—'}</div><div className="text-[11px] text-slate-500">Регистраций</div></div>
              <div className="rounded-xl bg-white border p-3"><Users className="h-4 w-4 text-violet-500" /><div className="mt-2 text-lg font-bold">{stats?.registeredVisitedCount ?? '—'}</div><div className="text-[11px] text-slate-500">Посетили</div></div>
              <div className="rounded-xl bg-white border p-3"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><div className="mt-2 text-lg font-bold">{registered ? `${visitRate}%` : '—'}</div><div className="text-[11px] text-slate-500">Доля посещения</div></div>
              <div className="rounded-xl bg-white border p-3"><FileText className="h-4 w-4 text-pink-500" /><div className="mt-2 text-lg font-bold">{detail?.files?.length ?? '—'}</div><div className="text-[11px] text-slate-500">Файлов</div></div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 truncate">{detail?.name || webinar.title}</div>
                  <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>ID сессии: {sessionId}</span>
                    {webinar.mtsLinkEventId && <span>ID события: {webinar.mtsLinkEventId}</span>}
                    {detail?.startsAt && <span>{fmtDate(detail.startsAt)}</span>}
                    {detail?.endsAt && <span>до {fmtDate(detail.endsAt).split(', ').slice(1).join(', ')}</span>}
                    {owner && <span>{owner}</span>}
                  </div>
                </div>
                <Badge variant="outline">{detail?.status || '—'}</Badge>
              </div>
              {detail?.description && <p className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{detail.description}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {recordLinks.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />{link.label}</Button>
                  </a>
                ))}
                <Button variant="outline" size="sm" onClick={loadParticipants} disabled={participantsLoading}>
                  {participantsLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Users className="h-3.5 w-3.5 mr-1.5" />}
                  {showParticipants ? 'Обновить участников' : 'Показать участников'}
                </Button>
                <Button variant="outline" size="sm" onClick={loadTranscripts} disabled={transcriptsLoading}>
                  {transcriptsLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FileText className="h-3.5 w-3.5 mr-1.5" />}
                  {showTranscripts ? 'Обновить расшифровки' : 'Расшифровки'}
                </Button>
              </div>
            </div>

            {showParticipants && (
              <div className="rounded-xl border bg-white overflow-hidden">
                <div className="px-4 py-3 border-b font-medium text-sm">Участники ({participants.length})</div>
                {participants.length ? (
                  <div className="divide-y max-h-80 overflow-auto">
                    {participants.slice(0, 100).map((p, index) => (
                      <div key={String(p.id ?? index)} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{[p.name, p.secondName].filter(Boolean).join(' ') || p.email || 'Без имени'}</div>
                          <div className="text-xs text-slate-500 truncate">{p.email || 'Email не указан'}</div>
                        </div>
                        <div className="text-xs flex flex-wrap gap-2">
                          <Badge variant="outline">{p.visited ? 'Был' : 'Не был'}</Badge>
                          {p.registerStatus && <span className="text-slate-500">{p.registerStatus}</span>}
                          {p.paymentStatus && <span className="text-slate-500">{p.paymentStatus}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 text-sm text-slate-500">Участников нет или доступ запрещён для API-ключа.</div>
                )}
              </div>
            )}

            {showTranscripts && (
              <div className="rounded-xl border bg-white overflow-hidden">
                <div className="px-4 py-3 border-b font-medium text-sm">Расшифровки</div>
                {transcripts.length ? (
                  <div className="divide-y">
                    {transcripts.map((tr) => (
                      <div key={String(tr.id)} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium">Расшифровка #{tr.id}</div>
                          <div className="text-xs text-slate-500 mt-1">{tr.createdAt ? fmtDate(tr.createdAt) : 'Дата не указана'} · {tr.status || '—'}</div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            const response = await fetch(`/api/mts-link?action=transcript&id=${encodeURIComponent(String(tr.id))}`, { cache: 'no-store' });
                            const data = await response.json().catch(() => ({}));
                            if (!response.ok) { toast.error(data.error || 'Не удалось получить расшифровку'); return; }
                            const summary = data.transcript?.data?.summary?.text || data.transcript?.summary?.text;
                            if (summary) toast.success(summary.slice(0, 180));
                            else toast('Расшифровка доступна в МТС Линк.');
                          }}
                        >
                          Открыть
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-5 text-sm text-slate-500">Готовых расшифровок пока нет.</div>
                )}
              </div>
            )}

            <div className="text-[11px] text-slate-400">
              {webinar.mtsLinkLastSyncAt ? `Последняя локальная синхронизация: ${fmtDate(webinar.mtsLinkLastSyncAt)}` : 'Связь с МТС Линк создана, локальная синхронизация ещё не зафиксирована.'}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
