'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { Webinar, Responsible } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Zap, Download, ExternalLink, RefreshCw, Users, Video } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className: string }> = {
  planned: { label: 'Планируется', variant: 'outline', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  active: { label: 'Активен', variant: 'default', className: 'bg-[#1E5BEB] text-white' },
  completed: { label: 'Проведён', variant: 'secondary', className: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Отменён', variant: 'destructive', className: 'bg-red-500 text-white' },
};

type WebinarForm = { title: string; description: string; date: string; time: string; responsibleId: string; email: string; status: Webinar['status'] };

const emptyWebinar: WebinarForm = { title: '', description: '', date: '', time: '', responsibleId: '', email: '', status: 'planned' };

export function WebinarsPage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Webinar | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebinarForm>(emptyWebinar);
  const [loading, setLoading] = useState(true);
  const [mtsWebinars, setMtsWebinars] = useState<any[]>([]);
  const [mtsLoading, setMtsLoading] = useState(false);
  const [mtsError, setMtsError] = useState('');
  const [showMts, setShowMts] = useState(false);

  const loadData = useCallback(() => {
    Promise.all([
      fetch('/api/webinars').then((r) => r.json()),
      fetch('/api/responsibles').then((r) => r.json()),
    ]).then(([w, r]) => { setWebinars(w); setResponsibles(r); setLoading(false); });
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const openCreate = () => { setEditing(null); setForm(emptyWebinar); setDialogOpen(true); };
  const openEdit = (w: Webinar) => { setEditing(w); setForm({ title: w.title, description: w.description || '', date: format(new Date(w.date), 'yyyy-MM-dd'), time: format(new Date(w.date), 'HH:mm'), responsibleId: w.responsibleId || '', email: w.email || '', status: w.status }); setDialogOpen(true); };
  const openDelete = (id: string) => { setDeletingId(id); setDeleteOpen(true); };

  const handleSave = async () => {
    const body = { ...form, date: `${form.date}T${form.time || '12:00'}`, responsibleId: form.responsibleId || null, email: form.email || null };
    if (editing) {
      await fetch('/api/webinars', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id: editing.id }) });
      toast.success('Вебинар обновлён');
    } else {
      await fetch('/api/webinars', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      toast.success('Вебинар создан');
    }
    setDialogOpen(false);
    triggerRefresh();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await fetch(`/api/webinars?id=${deletingId}`, { method: 'DELETE' });
    toast.success('Вебинар удалён');
    setDeleteOpen(false);
    triggerRefresh();
  };

  const handleGenerateTasks = async (webinarId: string) => {
    const res = await fetch('/api/webinars/generate-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ webinarId }) });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || 'Не удалось сгенерировать задачи');
      return;
    }
    if (data.skippedExisting > 0) {
      toast.success(`Создано задач: ${data.created} (уже было: ${data.skippedExisting})`);
    } else {
      toast.success('Задачи сгенерированы');
    }
    triggerRefresh();
  };

  const loadMtsWebinars = async () => {
    setMtsLoading(true);
    setMtsError('');
    try {
      const res = await fetch('/api/mts-link?action=webinars');
      const data = await res.json();
      if (data.error) { setMtsError(data.error); setMtsWebinars([]); }
      else { setMtsWebinars(data.webinars || []); }
    } catch (e: any) { setMtsError(e.message); }
    setMtsLoading(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch('/api/webinars', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    toast.success('Статус изменён');
    triggerRefresh();
  };

  if (loading) return <div className="p-4 md:p-6"><div className="h-64 animate-pulse bg-muted rounded-xl" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold">Вебинары</h1>
          <p className="text-muted-foreground">Управление вебинарами</p>
        </div>
        <Button onClick={openCreate} className="bg-[#1E5BEB] hover:bg-[#1E5BEB]/80">
          <Plus className="h-4 w-4 mr-2" />Создать
        </Button>
      </div>

      {webinars.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Нет вебинаров. Нажмите «Создать» чтобы добавить.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {webinars.map((w) => {
            const st = statusLabels[w.status] || statusLabels.planned;
            return (
              <Card key={w.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold truncate">{w.title}</h3>
                        <Badge className={st.className}>{st.label}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>{format(new Date(w.date), 'd MMMM yyyy, HH:mm', { locale: ru })}</span>
                        {w.responsible && <span>{w.responsible.name}</span>}
                        {w.tasks && w.tasks.length > 0 && <span>{w.tasks.length} задач</span>}
                      </div>
                      {w.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{w.description}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Select value={w.status} onValueChange={(v) => handleStatusChange(w.id, v)}>
                        <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Планируется</SelectItem>
                          <SelectItem value="active">Активен</SelectItem>
                          <SelectItem value="completed">Проведён</SelectItem>
                          <SelectItem value="cancelled">Отменён</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="icon" className="h-9 w-9 md:h-8 md:w-8" title="Сгенерировать задачи" onClick={() => handleGenerateTasks(w.id)}>
                        <Zap className="h-4 w-4 text-amber-500" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 md:h-8 md:w-8" onClick={() => openEdit(w)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-9 w-9 md:h-8 md:w-8 ml-1" onClick={() => openDelete(w.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* MTS Link — read-only data */}
      <Card className="mt-6">
        <div className="flex items-center justify-between p-4 pb-2">
          <div>
            <p className="text-base font-semibold flex items-center gap-2">
              <span className="text-[#E30611] font-bold">MTS</span> Линк — вебинары
            </p>
            <p className="text-xs text-muted-foreground">Данные из МТС Линк (только чтение)</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm"
              onClick={() => { if (!showMts && mtsWebinars.length === 0) loadMtsWebinars(); setShowMts(!showMts); }}
            >
              {showMts ? 'Скрыть' : 'Показать'}
            </Button>
            {showMts && (
              <Button variant="outline" size="sm" onClick={loadMtsWebinars} disabled={mtsLoading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${mtsLoading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
            )}
          </div>
        </div>
        {showMts && (
          <CardContent>
            {mtsError ? (
              <p className="text-sm text-red-500">{mtsError}</p>
            ) : mtsLoading ? (
              <div className="flex justify-center py-6"><RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : mtsWebinars.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Нет данных. Настройте API ключ в Настройках.</p>
            ) : (
              <div className="space-y-2">
                {mtsWebinars.map((w: any) => {
                  const startDate = w.startDate ? new Date(w.startDate) : null;
                  return (
                    <div key={w.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm truncate block">{w.title || 'Без названия'}</span>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                          {startDate && <span>{format(startDate, 'd MMM yyyy, HH:mm', { locale: ru })}</span>}
                          {w.participantCount > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{w.participantCount}</span>}
                          {w.ownerName && <span>{w.ownerName}</span>}
                          {w.status && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{w.status}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {w.joinUrl && (
                          <a href={w.joinUrl} target="_blank" rel="noopener">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-[#E30611] hover:text-[#E30611]">
                              <ExternalLink className="h-3 w-3" />Открыть
                            </Button>
                          </a>
                        )}
                        {w.recordUrl && (
                          <a href={w.recordUrl} target="_blank" rel="noopener">
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                              <Download className="h-3 w-3" />Запись
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Редактировать вебинар' : 'Новый вебинар'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Название</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Название вебинара" /></div>
            <div><Label>Описание</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Описание" rows={3} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Дата</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Время</Label><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div>
            </div>
            <div><Label>Ответственный</Label>
              <Select value={form.responsibleId} onValueChange={(v) => setForm({ ...form, responsibleId: v })}>
                <SelectTrigger><SelectValue placeholder="Выбрать" /></SelectTrigger>
                <SelectContent>
                  {responsibles.filter((r) => r.isActive).map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
            <div><Label>Статус</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Планируется</SelectItem>
                  <SelectItem value="active">Активен</SelectItem>
                  <SelectItem value="completed">Проведён</SelectItem>
                  <SelectItem value="cancelled">Отменён</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.date} className="bg-[#1E5BEB] hover:bg-[#1E5BEB]/80">
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить вебинар?</AlertDialogTitle>
          <AlertDialogDescription>Это действие нельзя отменить. Все связанные задачи будут удалены.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
