'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { DashboardStats, Task as TaskModel } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Film,
  ListTodo,
  RefreshCw,
  ShieldAlert,
  Users,
  Video,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { ru } from 'date-fns/locale';

const MSK = 'Europe/Moscow';

type DashboardWebinar = {
  id: string;
  title: string;
  date: string;
  status: string;
  responsible?: { name: string } | null;
  tasks?: TaskModel[];
  mtsLinkUrl?: string | null;
};

interface MtsStats {
  totalWebinars: number;
  completedWebinars: number;
  upcomingWebinars: number;
  totalParticipants: number;
  avgParticipants: number;
  recordingsCount: number;
}

const statusLabel: Record<string, string> = {
  planned: 'Запланирован',
  active: 'Идёт',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

function mskDayKey(value: Date | string) {
  return formatInTimeZone(value, MSK, 'yyyy-MM-dd');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  const todayKey = mskDayKey(new Date());
  const tomorrowKey = mskDayKey(new Date(Date.now() + 24 * 60 * 60_000));
  const targetKey = mskDayKey(date);
  if (targetKey === todayKey) return `Сегодня, ${formatInTimeZone(date, MSK, 'HH:mm')}`;
  if (targetKey === tomorrowKey) return `Завтра, ${formatInTimeZone(date, MSK, 'HH:mm')}`;
  return formatInTimeZone(date, MSK, 'd MMM, HH:mm', { locale: ru });
}

function Progress({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[110px]">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-[#1E5BEB] transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">{value}%</span>
    </div>
  );
}

export function DashboardPage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [webinars, setWebinars] = useState<DashboardWebinar[]>([]);
  const [tasks, setTasks] = useState<TaskModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [mtsStats, setMtsStats] = useState<MtsStats | null>(null);
  const [mtsLoading, setMtsLoading] = useState(false);
  const [mtsError, setMtsError] = useState('');

  const loadMtsStats = async () => {
    setMtsLoading(true);
    setMtsError('');
    try {
      const res = await fetch('/api/mts-link?action=stats', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Не удалось получить данные МТС Линк');
      setMtsStats(data);
    } catch (error) {
      setMtsError(error instanceof Error ? error.message : 'Ошибка загрузки МТС Линк');
    } finally {
      setMtsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetch('/api/dashboard', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/webinars', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/tasks', { cache: 'no-store' }).then((r) => r.json()),
    ])
      .then(([dashboard, webinarsData, tasksData]) => {
        if (!active) return;
        setStats(dashboard as DashboardStats);
        setWebinars(Array.isArray(webinarsData) ? webinarsData : []);
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      })
      .catch(() => {
        if (active) {
          setStats(null);
          setWebinars([]);
          setTasks([]);
        }
      })
      .finally(() => active && setLoading(false));

    loadMtsStats();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const upcomingWebinars = useMemo(() => {
    const now = Date.now();
    const weekEnd = now + 7 * 24 * 60 * 60_000;
    return webinars
      .filter((w) => {
        const time = new Date(w.date).getTime();
        return time >= now && time <= weekEnd && w.status !== 'cancelled';
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6);
  }, [webinars]);

  const overdueTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'done' && new Date(task.dueDate).getTime() < Date.now()),
    [tasks],
  );

  const todayTasks = useMemo(
    () => tasks
      .filter((task) => mskDayKey(task.dueDate) === mskDayKey(new Date()))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5),
    [tasks],
  );

  const nextWebinar = upcomingWebinars[0];
  const nextTasks = nextWebinar?.tasks ?? [];
  const nextDone = nextTasks.filter((task) => task.status === 'done').length;
  const nextProgress = nextTasks.length ? Math.round((nextDone / nextTasks.length) * 100) : 0;

  const attentionItems = useMemo(() => {
    const items: { tone: 'danger' | 'warning' | 'info'; icon: typeof ShieldAlert; title: string; detail: string }[] = [];
    if (overdueTasks.length) {
      items.push({ tone: 'danger', icon: ShieldAlert, title: `${overdueTasks.length} ${overdueTasks.length === 1 ? 'задача просрочена' : 'задачи просрочены'}`, detail: overdueTasks[0]?.title || 'Проверьте задачи' });
    }
    const noResponsible = upcomingWebinars.find((webinar) => !webinar.responsible);
    if (noResponsible) {
      items.push({ tone: 'warning', icon: AlertTriangle, title: `Вебинар «${noResponsible.title}» без ответственного`, detail: 'Назначьте ответственного, чтобы не пропустить подготовку' });
    }
    if (nextWebinar && (!nextWebinar.tasks || nextWebinar.tasks.length === 0)) {
      items.push({ tone: 'warning', icon: AlertTriangle, title: 'У ближайшего вебинара нет задач', detail: 'Сгенерируйте план подготовки' });
    }
    if (mtsError) {
      items.push({ tone: 'info', icon: RefreshCw, title: 'МТС Линк не синхронизирован', detail: mtsError });
    }
    return items.slice(0, 4);
  }, [mtsError, nextWebinar, overdueTasks, upcomingWebinars]);

  if (loading || !stats) {
    return (
      <div className="min-h-full bg-slate-50/70 p-4 md:p-7">
        <div className="max-w-[1500px] mx-auto space-y-5">
          <div className="h-20 rounded-2xl bg-white border animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 rounded-2xl bg-white border animate-pulse" />)}
          </div>
          <div className="h-60 rounded-2xl bg-white border animate-pulse" />
        </div>
      </div>
    );
  }

  const headerDate = formatInTimeZone(new Date(), MSK, "d MMMM yyyy, EEEE", { locale: ru });

  return (
    <div className="min-h-full bg-slate-50/70 p-4 md:p-7">
      <div className="max-w-[1500px] mx-auto space-y-5">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[#1E5BEB] font-semibold">{headerDate}</div>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-slate-950">Центр управления вебинарами</h1>
            <p className="mt-1 text-sm text-slate-500">Что происходит сегодня и что требует внимания.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white" onClick={() => setCurrentPage('calendar')}>
              <CalendarDays className="h-4 w-4 mr-2" /> Календарь
            </Button>
            <Button className="bg-[#1E5BEB] hover:bg-[#1749bb]" onClick={() => setCurrentPage('webinars')}>
              <Video className="h-4 w-4 mr-2" /> + Вебинар
            </Button>
          </div>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="border-rose-200/60 shadow-sm shadow-rose-100/40 bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Просрочено</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{overdueTasks.length}</p>
                  <p className="mt-1 text-xs text-slate-500">задач требуют внимания</p>
                </div>
                <span className="h-10 w-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><ShieldAlert className="h-5 w-5" /></span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-sky-200/60 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">На сегодня</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{stats.todayTasks}</p>
                  <p className="mt-1 text-xs text-slate-500">задач по плану</p>
                </div>
                <span className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center"><ListTodo className="h-5 w-5" /></span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-violet-200/60 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">На неделе</p>
                  <p className="mt-2 text-3xl font-bold text-slate-950">{upcomingWebinars.length}</p>
                  <p className="mt-1 text-xs text-slate-500">ближайших вебинара</p>
                </div>
                <span className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center"><Video className="h-5 w-5" /></span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-200/60 shadow-sm bg-white">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ближайший вебинар</p>
                  <p className="mt-2 text-xl font-bold text-slate-950 truncate">{nextWebinar ? formatDateTime(nextWebinar.date) : 'Нет запланированных'}</p>
                  <p className="mt-1 text-xs text-slate-500 truncate">{nextWebinar?.title || 'Создайте мероприятие'}</p>
                </div>
                <span className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Clock3 className="h-5 w-5" /></span>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-950 flex items-center gap-2"><ShieldAlert className="h-4.5 w-4.5 text-rose-500" /> Требует внимания</h2>
              <p className="text-xs text-slate-500 mt-0.5">Система сама подсветит проблемы до того, как они станут критичными.</p>
            </div>
            <Badge variant="secondary" className="rounded-full">{attentionItems.length}</Badge>
          </div>
          {attentionItems.length ? (
            <div className="divide-y">
              {attentionItems.map(({ tone, icon: Icon, title, detail }) => (
                <div key={`${tone}-${title}`} className="px-5 py-3.5 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tone === 'danger' ? 'bg-rose-50 text-rose-500' : tone === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">{title}</div>
                    <div className="text-xs text-slate-500 truncate">{detail}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300" />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-500" /> Сейчас всё в порядке</div>
          )}
        </section>

        <div className="grid min-w-0 grid-cols-1 xl:grid-cols-[1.45fr_0.85fr] gap-5">
          <Card className="min-w-0 overflow-hidden shadow-sm bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Ближайшие вебинары</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setCurrentPage('webinars')}>Все вебинары <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {upcomingWebinars.length ? (
                <div className="divide-y">
                  {upcomingWebinars.map((webinar) => {
                    const done = webinar.tasks?.filter((task) => task.status === 'done').length ?? 0;
                    const total = webinar.tasks?.length ?? 0;
                    const progress = total ? Math.round((done / total) * 100) : 0;
                    return (
                      <button key={webinar.id} type="button" onClick={() => setCurrentPage('webinars')} className="w-full py-4 text-left flex flex-col md:flex-row md:items-center gap-3 hover:bg-slate-50/70 rounded-xl px-2 -mx-2 transition-colors">
                        <div className="w-[90px] shrink-0">
                          <div className="text-sm font-semibold text-slate-900">{formatInTimeZone(webinar.date, MSK, 'd MMM', { locale: ru })}</div>
                          <div className="text-xs text-slate-500">{formatInTimeZone(webinar.date, MSK, 'HH:mm')}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-900 truncate">{webinar.title}</div>
                          <div className="text-xs text-slate-500 mt-1">{webinar.responsible?.name || 'Ответственный не назначен'} · {statusLabel[webinar.status] || webinar.status}</div>
                        </div>
                        <div className="w-full md:w-[150px]">
                          <div className="text-[11px] text-slate-400 mb-1">Готовность</div>
                          <Progress value={progress} />
                        </div>
                        <ArrowRight className="hidden md:block h-4 w-4 text-slate-300" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-10 text-center text-sm text-slate-500">Нет ближайших вебинаров.</div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0 overflow-hidden shadow-sm bg-white">
            <CardHeader className="pb-3">
              <div className="min-w-0 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">Подготовка ближайшего</CardTitle>
                  <p className="text-xs text-slate-500 mt-1 truncate">{nextWebinar?.title || 'Нет вебинара'}</p>
                </div>
                <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{nextProgress}%</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {nextWebinar && nextTasks.length ? (
                <div className="space-y-3">
                  {nextTasks.slice(0, 5).map((task, index) => (
                    <div key={task.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center ${task.status === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600'}`}>
                          {task.status === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-semibold">{index + 1}</span>}
                        </div>
                        {index < Math.min(nextTasks.length, 5) - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
                      </div>
                      <div className="min-w-0 pb-2">
                        <div className="text-sm font-medium truncate text-slate-900">{task.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatDateTime(task.dueDate)}</div>
                      </div>
                    </div>
                  ))}
                  <div className="pt-1">
                    <Progress value={nextProgress} />
                  </div>
                </div>
              ) : (
                <div className="py-8 text-sm text-slate-500">Для ближайшего вебинара пока нет сформированного плана.</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-5">
          <Card className="min-w-0 overflow-hidden shadow-sm bg-white">
            <CardHeader className="pb-3">
              <div className="min-w-0 flex items-center justify-between">
                <CardTitle className="text-base">Задачи на сегодня</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setCurrentPage('tasks')}>Все задачи <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {todayTasks.length ? (
                <div className="divide-y">
                  {todayTasks.map((task) => (
                    <div key={task.id} className="py-3.5 flex items-center gap-3">
                      <CheckCircle2 className={`h-4.5 w-4.5 shrink-0 ${task.status === 'done' ? 'text-emerald-500' : 'text-slate-300'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'}`}>{task.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{task.webinar?.title || 'Без вебинара'} · {task.responsible?.name || 'Не назначен'}</div>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{formatInTimeZone(task.dueDate, MSK, 'HH:mm')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-sm text-slate-500">На сегодня задач нет.</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm bg-white">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">МТС Линк</CardTitle>
                  <p className="text-xs text-slate-500 mt-1">Только сбор данных, без создания объектов в МТС Линк</p>
                </div>
                <Button variant="outline" size="sm" onClick={loadMtsStats} disabled={mtsLoading}>
                  <RefreshCw className={`h-3.5 w-3.5 ${mtsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {mtsError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">{mtsError}</div>
              ) : mtsStats ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 p-3"><Video className="h-4 w-4 text-[#1E5BEB]" /><div className="mt-2 text-xl font-bold">{mtsStats.totalWebinars}</div><div className="text-[11px] text-slate-500">Вебинаров</div></div>
                    <div className="rounded-xl bg-slate-50 p-3"><Users className="h-4 w-4 text-violet-500" /><div className="mt-2 text-xl font-bold">{mtsStats.totalParticipants}</div><div className="text-[11px] text-slate-500">Участников</div></div>
                    <div className="rounded-xl bg-slate-50 p-3"><Film className="h-4 w-4 text-pink-500" /><div className="mt-2 text-xl font-bold">{mtsStats.recordingsCount}</div><div className="text-[11px] text-slate-500">Записей</div></div>
                    <div className="rounded-xl bg-slate-50 p-3"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><div className="mt-2 text-xl font-bold">{mtsStats.completedWebinars}</div><div className="text-[11px] text-slate-500">Проведено</div></div>
                  </div>
                  <div className="mt-4 text-xs text-slate-500 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Синхронизация доступна <ExternalLink className="h-3 w-3 ml-auto" /></div>
                </>
              ) : (
                <div className="py-6 flex justify-center"><RefreshCw className="h-5 w-5 animate-spin text-slate-400" /></div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 px-1 pb-2">
          <span>Данные обновляются при изменениях в системе.</span>
          <span>Всего вебинаров: {stats.totalWebinars} · Всего задач: {stats.totalTasks}</span>
        </div>
      </div>
    </div>
  );
}
