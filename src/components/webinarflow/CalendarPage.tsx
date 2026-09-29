'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CalendarEvent } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, List, CalendarDays, Video, CheckSquare, Clock3 } from 'lucide-react';
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import { ru } from 'date-fns/locale';
import { formatMsk } from '@/lib/msk-time';

const MSK = 'Europe/Moscow';
type CalendarView = 'month' | 'week' | 'day';

function dayKey(value: Date | string) {
  return formatMsk(value, 'yyyy-MM-dd');
}

function viewRange(currentDate: Date, view: CalendarView) {
  if (view === 'month') return { start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }) };
  if (view === 'week') return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
  const start = new Date(currentDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function EventChip({ event }: { event: CalendarEvent }) {
  return (
    <div className="rounded-lg px-2 py-1.5 bg-slate-50 border border-slate-200 text-left">
      <div className="flex items-start gap-1.5"><span className="mt-0.5 shrink-0">{event.type === 'webinar' ? '🎬' : '📋'}</span><span className="text-xs font-medium text-slate-800 line-clamp-2">{event.title}</span></div>
      <div className="mt-1 text-[10px] text-slate-400">{formatMsk(event.date, 'HH:mm')} МСК{event.responsible ? ` · ${event.responsible}` : ''}</div>
    </div>
  );
}

export function CalendarPage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => viewRange(currentDate, view), [currentDate, view]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/calendar?start=${range.start.toISOString()}&end=${range.end.toISOString()}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось загрузить календарь');
      setEvents(Array.isArray(data) ? data : []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [range.start, range.end]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const eventsForDay = (date: Date) => events.filter((event) => dayKey(event.date) === dayKey(date));
  const todayKey = dayKey(new Date());
  const selectedEvents = eventsForDay(selectedDate).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const monthDays = useMemo(() => {
    if (view !== 'month') return [];
    const days: Date[] = [];
    for (let d = range.start; d <= range.end; d = addDays(d, 1)) days.push(new Date(d));
    return days;
  }, [range.start, range.end, view]);

  const weekDays = useMemo(() => {
    if (view !== 'week') return [];
    return Array.from({ length: 7 }, (_, index) => addDays(range.start, index));
  }, [range.start, view]);

  function move(step: number) {
    if (view === 'month') setCurrentDate((d) => step > 0 ? addMonths(d, 1) : subMonths(d, 1));
    else if (view === 'week') setCurrentDate((d) => step > 0 ? addWeeks(d, 1) : subWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, step));
  }

  function goToday() {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  }

  const title = view === 'month'
    ? format(currentDate, 'LLLL yyyy', { locale: ru })
    : view === 'week'
      ? `${format(weekDays[0] || currentDate, 'd MMM', { locale: ru })} — ${format(weekDays[6] || currentDate, 'd MMM yyyy', { locale: ru })}`
      : format(currentDate, 'd MMMM yyyy', { locale: ru });

  return (
    <div className="min-h-full bg-slate-50/70 p-4 md:p-7">
      <div className="max-w-[1500px] mx-auto space-y-5">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div><div className="text-xs uppercase tracking-[0.16em] text-[#1E5BEB] font-semibold">Планирование</div><h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-slate-950">Календарь</h1><p className="mt-1 text-sm text-slate-500">Вебинары и связанные задачи. Время отображается по МСК.</p></div>
          <div className="flex flex-wrap gap-2"><div className="flex items-center bg-white border rounded-xl p-1 shadow-sm"><Button variant={view === 'month' ? 'default' : 'ghost'} size="sm" className="h-8" onClick={() => setView('month')}><CalendarDays className="h-3.5 w-3.5 mr-1.5" />Месяц</Button><Button variant={view === 'week' ? 'default' : 'ghost'} size="sm" className="h-8" onClick={() => setView('week')}><List className="h-3.5 w-3.5 mr-1.5" />Неделя</Button><Button variant={view === 'day' ? 'default' : 'ghost'} size="sm" className="h-8" onClick={() => setView('day')}><Clock3 className="h-3.5 w-3.5 mr-1.5" />День</Button></div><Button variant="outline" onClick={goToday}>Сегодня</Button></div>
        </header>

        <Card className="rounded-2xl bg-white shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="px-4 md:px-5 py-4 border-b flex items-center justify-between gap-3"><Button variant="outline" size="icon" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button><h2 className="font-semibold text-slate-900 capitalize text-center">{title}</h2><Button variant="outline" size="icon" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button></div>
            {loading ? <div className="p-6 space-y-3"><div className="h-12 rounded-xl bg-slate-100 animate-pulse" /><div className="h-72 rounded-xl bg-slate-100 animate-pulse" /></div> : view === 'month' ? (
              <div className="p-3 md:p-5 overflow-x-auto">
                <div className="grid grid-cols-7 min-w-[760px] border border-slate-200 rounded-xl overflow-hidden">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map((name) => <div key={name} className="bg-slate-50 px-2 py-2 text-center text-[11px] font-semibold text-slate-400 border-b border-slate-200">{name}</div>)}{monthDays.map((date) => { const eventsToday = eventsForDay(date); const current = dayKey(date) === todayKey; const currentMonth = date.getMonth() === currentDate.getMonth(); return <button key={date.toISOString()} onClick={() => setSelectedDate(date)} className={`min-h-[110px] p-2 text-left align-top border-r border-b border-slate-200 last:border-r-0 transition-colors ${!currentMonth ? 'bg-slate-50/50 text-slate-300' : 'bg-white'} ${current ? 'ring-2 ring-inset ring-[#1E5BEB]/30' : 'hover:bg-slate-50'}`}><div className={`text-sm font-semibold ${current ? 'text-[#1E5BEB]' : 'text-slate-700'}`}>{format(date, 'd')}</div><div className="space-y-1 mt-2">{eventsToday.slice(0, 3).map((event) => <EventChip key={`${event.type}-${event.id}`} event={event} />)}{eventsToday.length > 3 && <div className="text-[10px] text-slate-400 px-1">+{eventsToday.length - 3} ещё</div>}</div></button>; })}</div>
              </div>
            ) : view === 'week' ? (
              <div className="p-3 md:p-5 overflow-x-auto"><div className="grid grid-cols-7 min-w-[900px] border border-slate-200 rounded-xl overflow-hidden">{weekDays.map((date) => { const dayEvents = eventsForDay(date); const current = dayKey(date) === todayKey; return <button key={date.toISOString()} onClick={() => setSelectedDate(date)} className={`min-h-[430px] p-3 text-left border-r border-slate-200 last:border-r-0 ${current ? 'bg-[#1E5BEB]/[0.03]' : 'bg-white hover:bg-slate-50'}`}><div className="flex items-center justify-between mb-3"><span className={`text-sm font-semibold ${current ? 'text-[#1E5BEB]' : 'text-slate-700'}`}>{format(date, 'EEE', { locale: ru })}</span><span className={`text-sm ${current ? 'text-[#1E5BEB] font-bold' : 'text-slate-400'}`}>{format(date, 'd')}</span></div><div className="space-y-2">{dayEvents.map((event) => <EventChip key={`${event.type}-${event.id}`} event={event} />)}</div></button>; })}</div></div>
            ) : (
              <div className="p-4 md:p-6"><div className="grid gap-3">{selectedEvents.length ? selectedEvents.map((event) => <div key={`${event.type}-${event.id}`} className="rounded-xl border bg-slate-50/70 p-4 flex items-start gap-3"><div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center border text-[#1E5BEB]">{event.type === 'webinar' ? <Video className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}</div><div className="flex-1 min-w-0"><div className="font-medium text-slate-900">{event.title}</div><div className="mt-1 text-sm text-slate-500">{formatMsk(event.date, 'HH:mm')} МСК {event.responsible ? `· ${event.responsible}` : ''}</div>{event.webinarTitle && <div className="mt-1 text-xs text-slate-400">Вебинар: {event.webinarTitle}</div>}</div><Badge variant="outline">{event.type === 'webinar' ? 'Вебинар' : event.taskType || 'Задача'}</Badge></div>) : <div className="py-12 text-center text-sm text-slate-500">На этот день ничего не запланировано.</div>}</div></div>
            )}
          </CardContent>
        </Card>

        {view !== 'day' && <section className="rounded-2xl border bg-white shadow-sm p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Выбранный день</h2><p className="text-xs text-slate-500 mt-1">{format(selectedDate, 'd MMMM yyyy, EEEE', { locale: ru })}</p></div><Badge variant="outline">{selectedEvents.length} событий</Badge></div>{selectedEvents.length > 0 && <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-4">{selectedEvents.map((event) => <EventChip key={`${event.type}-${event.id}`} event={event} />)}</div>}</section>}
      </div>
    </div>
  );
}
