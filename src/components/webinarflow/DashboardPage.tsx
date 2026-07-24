'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { DashboardStats } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Video, Play, CheckSquare, Clock, ArrowRight, CheckCircle2, Users, Film, BarChart3, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const statCards = [
  { key: 'totalWebinars' as const, label: 'Всего вебинаров', icon: Video, color: 'text-[#1E5BEB] bg-[#1E5BEB]/10' },
  { key: 'activeWebinars' as const, label: 'Активные', icon: Play, color: 'text-[#4DA6FF] bg-[#4DA6FF]/10' },
  { key: 'totalTasks' as const, label: 'Всего задач', icon: CheckSquare, color: 'text-[#0F2557] bg-[#0F2557]/10' },
  { key: 'todayTasks' as const, label: 'На сегодня', icon: Clock, color: 'text-amber-600 bg-amber-50' },
];

interface MtsStats {
  totalWebinars: number;
  completedWebinars: number;
  upcomingWebinars: number;
  totalParticipants: number;
  avgParticipants: number;
  recordingsCount: number;
}

export function DashboardPage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mtsStats, setMtsStats] = useState<MtsStats | null>(null);
  const [mtsLoading, setMtsLoading] = useState(false);
  const [mtsError, setMtsError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const loadMtsStats = () => {
    setMtsLoading(true);
    setMtsError('');
    fetch('/api/mts-link?action=stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMtsError(data.error);
        else setMtsStats(data);
      })
      .catch((e) => setMtsError(e.message))
      .finally(() => setMtsLoading(false));
  };

  useEffect(() => { loadMtsStats(); }, [refreshKey]);

  if (loading || !stats) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 animate-pulse bg-muted rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="hidden md:block">
        <h1 className="text-2xl font-bold">Дашборд</h1>
        <p className="text-muted-foreground">Обзор системы управления вебинарами</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ key, label, icon: Icon, color }) => (
          <Card key={key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats[key]}</div>
              {key === 'totalTasks' && (
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.completedTasks} выполнено, {stats.pendingTasks} в работе
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MTS Link stats */}
      <Card>
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <div>
            <p className="text-base font-semibold flex items-center gap-2">
              <span className="text-[#E30611] font-bold">MTS</span> Линк — статистика
            </p>
            <p className="text-xs text-muted-foreground">Данные из МТС Линк API (только чтение)</p>
          </div>
          <Button variant="outline" size="sm" onClick={loadMtsStats} disabled={mtsLoading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${mtsLoading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
        <CardContent>
          {mtsError ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-2">{mtsError}</p>
              <p className="text-xs text-muted-foreground">Настройте API ключ в Настройках</p>
            </div>
          ) : mtsStats ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center mx-auto mb-1.5 w-8 h-8 rounded-lg bg-[#1E5BEB]/10 text-[#1E5BEB]"><Video className="h-4 w-4" /></div>
                <div className="text-2xl font-bold">{mtsStats.totalWebinars}</div>
                <div className="text-[10px] text-muted-foreground">Всего в МТС Линк</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mx-auto mb-1.5 w-8 h-8 rounded-lg bg-green-50 text-green-600"><CheckCircle2 className="h-4 w-4" /></div>
                <div className="text-2xl font-bold">{mtsStats.completedWebinars}</div>
                <div className="text-[10px] text-muted-foreground">Проведено</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mx-auto mb-1.5 w-8 h-8 rounded-lg bg-amber-50 text-amber-600"><Play className="h-4 w-4" /></div>
                <div className="text-2xl font-bold">{mtsStats.upcomingWebinars}</div>
                <div className="text-[10px] text-muted-foreground">Предстоящих</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mx-auto mb-1.5 w-8 h-8 rounded-lg bg-violet-50 text-violet-600"><Users className="h-4 w-4" /></div>
                <div className="text-2xl font-bold">{mtsStats.totalParticipants}</div>
                <div className="text-[10px] text-muted-foreground">Всего участников</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mx-auto mb-1.5 w-8 h-8 rounded-lg bg-blue-50 text-blue-600"><BarChart3 className="h-4 w-4" /></div>
                <div className="text-2xl font-bold">{mtsStats.avgParticipants}</div>
                <div className="text-[10px] text-muted-foreground">Среднее на вебинар</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mx-auto mb-1.5 w-8 h-8 rounded-lg bg-pink-50 text-pink-600"><Film className="h-4 w-4" /></div>
                <div className="text-2xl font-bold">{mtsStats.recordingsCount}</div>
                <div className="text-[10px] text-muted-foreground">Записей</div>
              </div>
            </div>
          ) : mtsLoading ? (
            <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-[#1E5BEB]" />
            Ближайшие задачи
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.upcomingTasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">Нет задач на сегодня и завтра</p>
          ) : (
            <div className="space-y-3">
              {stats.upcomingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${task.status === 'done' ? 'text-[#1E5BEB]' : 'text-muted-foreground'}`} />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.responsible?.name || 'Не назначен'}
                        {task.webinar ? ` · ${task.webinar.title}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={task.status === 'done' ? 'default' : 'outline'} className={task.status === 'done' ? 'bg-[#1E5BEB]' : ''}>
                      {task.status === 'done' ? 'Готово' : task.status === 'in_progress' ? 'В работе' : 'В ожидании'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(task.dueDate), 'd MMM HH:mm', { locale: ru })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
