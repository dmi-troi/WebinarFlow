'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { CalendarEvent } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Video, CheckSquare } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ru } from 'date-fns/locale';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export function CalendarPage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    fetch(`/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`)
      .then((r) => r.json())
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [currentMonth]);

  useEffect(() => { setLoading(true); loadEvents(); }, [loadEvents, refreshKey]);

  const getEventsForDate = (date: Date) => events.filter((e) => isSameDay(new Date(e.date), date));

  const monthStart = startOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) { days.push(day); day = addDays(day, 1); }

  const selectedEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold">Календарь</h1>
          <p className="text-muted-foreground">Вебинары и задачи по датам</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h2>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {DAYS.map((d) => (
              <div key={d} className="bg-card p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
            {days.map((d, i) => {
              const dayEvents = getEventsForDate(d);
              const isSelected = selectedDate && isSameDay(d, selectedDate);
              return (
                <button
                  key={i}
                  className={`bg-card p-2 min-h-20 text-left transition-colors hover:bg-muted/50 ${
                    !isSameMonth(d, currentMonth) ? 'opacity-40' : ''
                  } ${isSelected ? 'ring-2 ring-[#1E5BEB] ring-inset' : ''} ${isToday(d) ? 'bg-[#1E5BEB]/10' : ''}`}
                  onClick={() => setSelectedDate(d)}
                >
                  <span className={`text-sm ${isToday(d) ? 'font-bold text-[#1E5BEB]' : 'text-foreground'}`}>
                    {format(d, 'd')}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map((e) => (
                      <div
                        key={e.id}
                        className="text-xs truncate rounded px-1 py-0.5"
                        style={{ backgroundColor: e.color + '20', color: e.color, borderLeft: `2px solid ${e.color}` }}
                      >
                        {e.type === 'webinar' ? '🎬' : '📋'} {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-muted-foreground">+{dayEvents.length - 2}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDate && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">{format(selectedDate, 'd MMMM yyyy, EEEE', { locale: ru })}</h3>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Нет событий на эту дату</p>
            ) : (
              <div className="space-y-2">
                {selectedEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    {e.type === 'webinar' ? <Video className="h-4 w-4 text-[#1E5BEB]" /> : <CheckSquare className="h-4 w-4" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{e.type === 'webinar' ? 'Вебинар' : e.taskType}</Badge>
                        {e.responsible && <span className="text-xs text-muted-foreground">{e.responsible}</span>}
                        {e.type === 'task' && <span className="text-xs text-muted-foreground">{format(new Date(e.date), 'HH:mm')}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}