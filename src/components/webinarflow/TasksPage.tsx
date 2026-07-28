'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { Task, Responsible, Webinar } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Plus, Pencil, Trash2, CheckSquare, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const taskTypeLabels: Record<string, { label: string; color: string }> = {
  unisender: { label: 'Юнисендер', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  mtsLink: { label: 'МТС Link', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  reminder: { label: 'Напоминание', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  eventDay: { label: 'День мероприятия', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  general: { label: 'Общая', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: 'В ожидании', className: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'В работе', className: 'bg-amber-100 text-amber-700' },
  done: { label: 'Готово', className: 'bg-[#1E5BEB]/10 text-[#1E5BEB]' },
};

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'done';
type TaskForm = { title: string; webinarId: string; responsibleId: string; taskType: Task['taskType']; dueDate: string; dueTime: string; reminderTime: string; status: Task['status'] };

const emptyTask: TaskForm = { title: '', webinarId: '', responsibleId: '', taskType: 'general', dueDate: '', dueTime: '', reminderTime: '', status: 'pending' };

export function TasksPage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyTask);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    Promise.all([
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/responsibles').then((r) => r.json()),
      fetch('/api/webinars').then((r) => r.json()),
    ]).then(([t, r, w]) => { setTasks(t); setResponsibles(r); setWebinars(w); setLoading(false); });
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  const openCreate = () => { setEditing(null); setForm(emptyTask); setDialogOpen(true); };
  const openEdit = (t: Task) => {
    setEditing(t);
    setForm({
      title: t.title, webinarId: t.webinarId || '', responsibleId: t.responsibleId || '',
      taskType: t.taskType, dueDate: format(new Date(t.dueDate), 'yyyy-MM-dd'), dueTime: format(new Date(t.dueDate), 'HH:mm'),
      reminderTime: t.reminderTime || '', status: t.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const body = {
      title: form.title,
      dueDate: `${form.dueDate}T${form.dueTime || '09:00'}`,
      webinarId: form.webinarId || null,
      responsibleId: form.responsibleId || null,
      taskType: form.taskType,
      reminderTime: form.reminderTime || null,
      status: form.status,
    };
    if (editing) {
      await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id: editing.id }) });
      toast.success('Задача обновлена');
    } else {
      await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      toast.success('Задача создана');
    }
    setDialogOpen(false);
    triggerRefresh();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await fetch(`/api/tasks?id=${deletingId}`, { method: 'DELETE' });
    toast.success('Задача удалена');
    setDeleteOpen(false);
    triggerRefresh();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    toast.success('Статус изменён');
    triggerRefresh();
  };

  const filterTabs: { value: FilterStatus; label: string; count: number }[] = [
    { value: 'all', label: 'Все', count: tasks.length },
    { value: 'pending', label: 'В ожидании', count: tasks.filter((t) => t.status === 'pending').length },
    { value: 'in_progress', label: 'В работе', count: tasks.filter((t) => t.status === 'in_progress').length },
    { value: 'done', label: 'Выполнено', count: tasks.filter((t) => t.status === 'done').length },
  ];

  if (loading) return <div className="p-6"><div className="h-64 animate-pulse bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold">Задачи</h1>
          <p className="text-muted-foreground">Управление задачами</p>
        </div>
        <Button onClick={openCreate} className="bg-[#1E5BEB] hover:bg-[#1E5BEB]/80">
          <Plus className="h-4 w-4 mr-2" />Создать
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        {filterTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={filter === tab.value ? 'default' : 'outline'}
            size="sm"
            className={filter === tab.value ? 'bg-[#1E5BEB] hover:bg-[#1E5BEB]/80' : ''}
            onClick={() => setFilter(tab.value)}
          >
            {tab.label} <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Нет задач</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const tt = taskTypeLabels[t.taskType] || taskTypeLabels.general;
            const st = statusLabels[t.status] || statusLabels.pending;
            return (
              <Card key={t.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${t.status === 'done' ? 'bg-[#1E5BEB] border-emerald-500' : 'border-gray-300 hover:border-emerald-400'}`}
                      onClick={() => handleStatusChange(t.id, t.status === 'done' ? 'pending' : 'done')}
                    >
                      {t.status === 'done' && <span className="text-white text-xs">✓</span>}
                    </button>
                    <div className="min-w-0">
                      <p className={`font-medium text-sm ${t.status === 'done' ? 'line-through text-muted-foreground' : ''} truncate`}>{t.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className={`text-xs ${tt.color}`}>{tt.label}</Badge>
                        {t.webinar && <span className="text-xs text-muted-foreground">🎬 {t.webinar.title}</span>}
                        {t.responsible && <span className="text-xs text-muted-foreground">👤 {t.responsible.name}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-muted-foreground mr-2">
                      {format(new Date(t.dueDate), 'd MMM HH:mm', { locale: ru })}
                      {t.reminderTime && ` · ${t.reminderTime}`}
                    </span>
                    <Select value={t.status} onValueChange={(v) => handleStatusChange(t.id, v)}>
                      <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">В ожидании</SelectItem>
                        <SelectItem value="in_progress">В работе</SelectItem>
                        <SelectItem value="done">Готово</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeletingId(t.id); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Редактировать задачу' : 'Новая задача'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Название</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Название задачи" /></div>
            <div><Label>Тип задачи</Label>
              <Select value={form.taskType} onValueChange={(v) => setForm({ ...form, taskType: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(taskTypeLabels).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Дата</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
              <div><Label>Время</Label><Input type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} /></div>
            </div>
            <div><Label>Время напоминания (HH:MM)</Label><Input value={form.reminderTime} onChange={(e) => setForm({ ...form, reminderTime: e.target.value })} placeholder="09:00" /></div>
            <div><Label>Вебинар</Label>
              <Select value={form.webinarId} onValueChange={(v) => setForm({ ...form, webinarId: v })}>
                <SelectTrigger><SelectValue placeholder="Не привязан" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Не привязан</SelectItem>
                  {webinars.map((w) => (<SelectItem key={w.id} value={w.id}>{w.title}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Ответственный</Label>
              <Select value={form.responsibleId} onValueChange={(v) => setForm({ ...form, responsibleId: v })}>
                <SelectTrigger><SelectValue placeholder="Выбрать" /></SelectTrigger>
                <SelectContent>
                  {responsibles.filter((r) => r.isActive).map((r) => (<SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={!form.title || !form.dueDate} className="bg-[#1E5BEB] hover:bg-[#1E5BEB]/80">
              {editing ? 'Сохранить' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить задачу?</AlertDialogTitle>
          <AlertDialogDescription>Это действие нельзя отменить.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}