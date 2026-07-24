'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Archive, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export function ArchivePage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  const [archive, setArchive] = useState<{ webinars: any[]; tasks: any[] }>({ webinars: [], tasks: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/archive')
      .then((r) => r.json())
      .then(setArchive)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleRestore = async (type: 'webinar' | 'task', id: string) => {
    await fetch('/api/archive', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id }),
    });
    toast.success('Восстановлено');
    triggerRefresh();
  };

  if (loading) return <div className="p-6"><div className="h-64 animate-pulse bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6 hidden md:block">
        <h1 className="text-2xl font-bold">Архив</h1>
        <p className="text-muted-foreground">Просмотр и восстановление архивированных элементов</p>
      </div>

      <Tabs defaultValue="webinars">
        <TabsList>
          <TabsTrigger value="webinars">Вебинары ({archive.webinars.length})</TabsTrigger>
          <TabsTrigger value="tasks">Задачи ({archive.tasks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="webinars" className="mt-4">
          {archive.webinars.length === 0 ? (
            <Card><CardContent className="p-12 text-center">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Архив вебинаров пуст</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {archive.webinars.map((w) => (
                <Card key={w.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{w.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(w.date), 'd MMM yyyy', { locale: ru })} · Архивирован {format(new Date(w.archivedAt), 'd MMM yyyy', { locale: ru })}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleRestore('webinar', w.id)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />Восстановить
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          {archive.tasks.length === 0 ? (
            <Card><CardContent className="p-12 text-center">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Архив задач пуст</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {archive.tasks.map((t) => (
                <Card key={t.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.dueDate), 'd MMM yyyy', { locale: ru })} · Архивирован {format(new Date(t.archivedAt), 'd MMM yyyy', { locale: ru })}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleRestore('task', t.id)}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />Восстановить
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}