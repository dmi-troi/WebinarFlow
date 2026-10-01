'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Responsible, Task, Webinar } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Archive, CalendarClock, CheckCircle2, CircleAlert, ClipboardList, GripVertical,
  List, Pencil, Plus, Search, Trash2, UserRound, Video, Columns3,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatInTimeZone } from 'date-fns-tz';
import { mskDateInputValue, mskInputToDate, mskTimeInputValue } from '@/lib/msk-time';

const MSK = 'Europe/Moscow';

type FilterStatus = 'all' | 'pending' | 'in_progress' | 'done' | 'overdue';
type ViewMode = 'list' | 'kanban';
type TaskForm = {
  title: string;
  webinarId: string;
  responsibleId: string;
  taskType: Task['taskType'];
  dueDate: string;
  dueTime: string;
  status: Task['status'];
};

const emptyTask: TaskForm = { title: '', webinarId: '', responsibleId: '', taskType: 'general', dueDate: '', dueTime: '09:00', status: 'pending' };

const typeMeta: Record<string, { label: string; className: string }> = {
  unisender: { label: 'Юнисендер', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  mtsLink: { label: 'МТС Link', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  reminder: { label: 'Напоминание', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  eventDay: { label: 'День мероприятия', className: 'bg-rose-50 text-rose-700 border-rose-200' },
  sms: { label: 'SMS', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  general: { label: 'Общая', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const statusMeta: Record<string, { label: string; className: string }> = {
  pending: { label: 'В ожидании', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  in_progress: { label: 'В работе', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  done: { label: 'Готово', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  archived: { label: 'В архиве', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const kanbanColumns: Array<{ status: Task['status']; title: string }> = [
  { status: 'pending', title: 'В ожидании' },
  { status: 'in_progress', title: 'В работе' },
  { status: 'done', title: 'Готово' },
];

function isOverdue(task: Task) {
  return task.status !== 'done' && task.status !== 'archived' && new Date(task.dueDate).getTime() < Date.now();
}

function formatTaskDate(value: string) {
  return formatInTimeZone(value, MSK, 'd MMM yyyy, HH:mm');
}

export function TasksPage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskForm>(emptyTask);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [taskData, responsibleData, webinarData] = await Promise.all([
        fetch('/api/tasks', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/responsibles', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/webinars', { cache: 'no-store' }).then((r) => r.json()),
      ]);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setResponsibles(Array.isArray(responsibleData) ? responsibleData : []);
      setWebinars(Array.isArray(webinarData) ? webinarData : []);
    } catch {
      toast.error('Не удалось загрузить задачи');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const filtered = useMemo(() => tasks.filter((task) => {
    const overdue = isOverdue(task);
    if (filter === 'overdue' && !overdue) return false;
    if (filter !== 'all' && filter !== 'overdue' && task.status !== filter) return false;
    if (responsibleFilter !== 'all' && task.responsibleId !== responsibleFilter) return false;
    const q = query.trim().toLowerCase();
    if (q && !task.title.toLowerCase().includes(q) && !(task.webinar?.title || '').toLowerCase().includes(q)) return false;
    if (dateFrom && new Date(task.dueDate).getTime() < mskInputToDate(dateFrom, '00:00').getTime()) return false;
    if (dateTo && new Date(task.dueDate).getTime() > mskInputToDate(dateTo, '23:59').getTime()) return false;
    return true;
  }), [tasks, filter, responsibleFilter, query, dateFrom, dateTo]);

  const counts = useMemo(() => ({
    overdue: tasks.filter(isOverdue).length,
    today: tasks.filter((task) => formatInTimeZone(task.dueDate, MSK, 'yyyy-MM-dd') === formatInTimeZone(new Date(), MSK, 'yyyy-MM-dd')).length,
    done: tasks.filter((task) => task.status === 'done').length,
  }), [tasks]);

  const openCreate = () => { setEditing(null); setForm(emptyTask); setDialogOpen(true); };
  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      title: task.title,
      webinarId: task.webinarId || '',
      responsibleId: task.responsibleId || '',
      taskType: task.taskType,
      dueDate: mskDateInputValue(task.dueDate),
      dueTime: mskTimeInputValue(task.dueDate),
      status: task.status === 'archived' ? 'done' : task.status,
    });
    setDialogOpen(true);
  };

  const saveTask = async () => {
    const payload = {
      title: form.title.trim(),
      webinarId: form.webinarId || null,
      responsibleId: form.responsibleId || null,
      taskType: form.taskType,
      dueDate: mskInputToDate(form.dueDate, form.dueTime || '09:00'),
      status: form.status,
    };
    try {
      const response = await fetch('/api/tasks', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...payload, id: editing.id } : payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось сохранить задачу');
      }
      toast.success(editing ? 'Задача обновлена' : 'Задача создана');
      setDialogOpen(false);
      triggerRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения');
    }
  };

  const changeStatus = async (id: string, status: Task['status']) => {
    if (status === 'archived') return;
    try {
      const response = await fetch('/api/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
      if (!response.ok) throw new Error('Не удалось изменить статус');
      triggerRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка изменения статуса');
    }
  };

  const deleteTask = async () => {
    if (!deletingId) return;
    try {
      const response = await fetch(`/api/tasks?id=${deletingId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Не удалось удалить задачу');
      toast.success('Задача удалена');
      setDeleteOpen(false);
      triggerRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка удаления');
    }
  };

  const archiveTask = async (id: string) => {
    try {
      const response = await fetch('/api/archive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'task', id }) });
      if (!response.ok) throw new Error('Не удалось отправить задачу в архив');
      toast.success('Задача в архиве');
      triggerRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка архивации');
    }
  };

  if (loading) {
    return <div className="p-4 md:p-7 bg-slate-50/70 min-h-full"><div className="max-w-[1500px] mx-auto space-y-4"><div className="h-20 rounded-2xl bg-white border animate-pulse" />{[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-white border animate-pulse" />)}</div></div>;
  }

  return (
    <div className="min-h-full bg-slate-50/70 p-4 md:p-7">
      <div className="max-w-[1500px] mx-auto space-y-5">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[#1E5BEB] font-semibold">Операционная работа</div>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-slate-950">Задачи</h1>
            <p className="mt-1 text-sm text-slate-500">Что нужно сделать сегодня, что просрочено и кто отвечает.</p>
          </div>
          <Button onClick={openCreate} className="bg-[#1E5BEB] hover:bg-[#1749bb]"><Plus className="h-4 w-4 mr-2" /> Задача</Button>
        </header>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="rounded-2xl bg-white shadow-sm"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Просрочено</div><div className="mt-1 text-2xl font-bold text-slate-950">{counts.overdue}</div><div className="text-xs text-slate-500 mt-1">незавершённых задач</div></CardContent></Card>
          <Card className="rounded-2xl bg-white shadow-sm"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">На сегодня</div><div className="mt-1 text-2xl font-bold text-slate-950">{counts.today}</div><div className="text-xs text-slate-500 mt-1">задач в плане</div></CardContent></Card>
          <Card className="rounded-2xl bg-white shadow-sm"><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Выполнено</div><div className="mt-1 text-2xl font-bold text-slate-950">{counts.done}</div><div className="text-xs text-slate-500 mt-1">задач всего</div></CardContent></Card>
        </section>

        <section className="rounded-2xl border bg-white shadow-sm p-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по задаче или вебинару" className="pl-9 bg-slate-50/60" /></div>
            <Select value={filter} onValueChange={(value) => setFilter(value as FilterStatus)}><SelectTrigger className="w-full xl:w-44 bg-slate-50/60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Все задачи</SelectItem><SelectItem value="overdue">Просрочено</SelectItem><SelectItem value="pending">В ожидании</SelectItem><SelectItem value="in_progress">В работе</SelectItem><SelectItem value="done">Готово</SelectItem></SelectContent></Select>
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}><SelectTrigger className="w-full xl:w-56 bg-slate-50/60"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Все ответственные</SelectItem>{responsibles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1"><Button variant={view === 'list' ? 'default' : 'ghost'} size="sm" className="h-8 px-3" onClick={() => setView('list')}><List className="h-3.5 w-3.5 mr-1.5" />Список</Button><Button variant={view === 'kanban' ? 'default' : 'ghost'} size="sm" className="h-8 px-3" onClick={() => setView('kanban')}><Columns3 className="h-3.5 w-3.5 mr-1.5" />Kanban</Button></div>
            <div className="flex items-center gap-2 ml-0 xl:ml-auto"><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 w-36 text-xs" /><span className="text-xs text-slate-400">—</span><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 w-36 text-xs" /></div>
          </div>
        </section>

        {filtered.length === 0 ? <Card className="rounded-2xl border-dashed bg-white"><CardContent className="p-12 text-center"><ClipboardList className="h-10 w-10 mx-auto text-slate-300 mb-3" /><p className="font-medium text-slate-800">Задач не найдено</p><p className="text-sm text-slate-500 mt-1">Измените фильтры или создайте новую задачу.</p></CardContent></Card> : view === 'list' ? (
          <div className="space-y-2">
            {filtered.map((task) => {
              const type = typeMeta[task.taskType] || typeMeta.general;
              const status = statusMeta[task.status] || statusMeta.pending;
              const overdue = isOverdue(task);
              const completed = task.status === 'done';
              const stateClass = completed
                ? 'bg-emerald-50/80 border-emerald-200'
                : overdue
                  ? 'bg-rose-50/80 border-rose-200'
                  : 'bg-white border-slate-200/80';
              return <Card key={task.id} className={`rounded-2xl shadow-sm ${stateClass}`}>
                <CardContent className="p-4 md:p-5"><div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-slate-900 truncate">{task.title}</h3><Badge variant="outline" className={`text-[10px] ${type.className}`}>{type.label}</Badge>{completed && <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Выполнено</Badge>}
                          {overdue && <Badge variant="outline" className="text-[10px] bg-rose-100 text-rose-700 border-rose-200"><CircleAlert className="h-3 w-3 mr-1" />Просрочено</Badge>}</div><div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{formatTaskDate(task.dueDate)} МСК</span><span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{task.responsible?.name || 'Не назначен'}</span>{task.webinar && <span className="inline-flex items-center gap-1.5"><Video className="h-3.5 w-3.5" />{task.webinar.title}</span>}</div></div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0"><Select value={task.status} onValueChange={(v) => changeStatus(task.id, v as Task['status'])}><SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">В ожидании</SelectItem><SelectItem value="in_progress">В работе</SelectItem><SelectItem value="done">Готово</SelectItem></SelectContent></Select><Button variant="outline" size="icon" className="h-9 w-9" title="Изменить" onClick={() => openEdit(task)}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="icon" className="h-9 w-9" title="В архив" onClick={() => archiveTask(task.id)}><Archive className="h-4 w-4" /></Button><Button variant="outline" size="icon" className="h-9 w-9" title="Удалить" onClick={() => { setDeletingId(task.id); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-rose-500" /></Button></div>
                </div></CardContent>
              </Card>;
            })}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
            {kanbanColumns.map((column) => {
              const columnTasks = filtered.filter((task) => task.status === column.status);
              return <section key={column.status} className="min-w-[300px] flex-1 rounded-2xl border bg-slate-100/70 p-3 snap-start" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (draggingId) { void changeStatus(draggingId, column.status); setDraggingId(null); } }}>
                <div className="flex items-center justify-between px-1 pb-3"><div className="flex items-center gap-2"><h2 className="font-semibold text-sm text-slate-900">{column.title}</h2><span className="text-xs rounded-full bg-white px-2 py-0.5 text-slate-500">{columnTasks.length}</span></div></div>
                <div className="space-y-2 min-h-[180px]">{columnTasks.map((task) => { const type = typeMeta[task.taskType] || typeMeta.general; return <div key={task.id} draggable onDragStart={() => setDraggingId(task.id)} onDragEnd={() => setDraggingId(null)} className={`rounded-xl border p-3 shadow-sm cursor-grab active:cursor-grabbing ${task.status === 'done' ? 'bg-emerald-50/80 border-emerald-200' : isOverdue(task) ? 'bg-rose-50/80 border-rose-200' : 'bg-white border-slate-200'} ${draggingId === task.id ? 'opacity-50' : ''}`}><div className="flex items-start gap-2"><GripVertical className="h-4 w-4 text-slate-300 mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900">{task.title}</p><div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="outline" className={`text-[10px] ${type.className}`}>{type.label}</Badge>{isOverdue(task) && <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">Просрочено</Badge>}</div><p className="mt-2 text-[11px] text-slate-500">{formatTaskDate(task.dueDate)}</p><p className="text-[11px] text-slate-500">{task.responsible?.name || 'Ответственный не назначен'}</p></div></div><div className="mt-3 pt-2 border-t flex gap-1.5"><Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openEdit(task)}><Pencil className="h-3 w-3 mr-1" />Изменить</Button>{column.status !== 'done' && <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => changeStatus(task.id, 'done')}><CheckCircle2 className="h-3 w-3 mr-1" />Готово</Button>}</div></div>; })}</div>
              </section>;
            })}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? 'Редактировать задачу' : 'Новая задача'}</DialogTitle><DialogDescription>Дата и время указываются по Москве (МСК).</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Название</Label><Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Что нужно сделать" /></div><div><Label>Вебинар</Label><Select value={form.webinarId || 'none'} onValueChange={(value) => setForm({ ...form, webinarId: value === 'none' ? '' : value })}><SelectTrigger className="mt-1"><SelectValue placeholder="Без привязки" /></SelectTrigger><SelectContent><SelectItem value="none">Без привязки</SelectItem>{webinars.map((w) => <SelectItem key={w.id} value={w.id}>{w.title}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label>Ответственный</Label><Select value={form.responsibleId || 'none'} onValueChange={(value) => setForm({ ...form, responsibleId: value === 'none' ? '' : value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Не назначен</SelectItem>{responsibles.filter((r) => r.isActive).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div><div><Label>Тип</Label><Select value={form.taskType} onValueChange={(value) => setForm({ ...form, taskType: value as Task['taskType'] })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeMeta).map(([key, meta]) => <SelectItem key={key} value={key}>{meta.label}</SelectItem>)}</SelectContent></Select></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label>Дата</Label><Input className="mt-1" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div><div><Label>Время</Label><Input className="mt-1" type="time" value={form.dueTime} onChange={(e) => setForm({ ...form, dueTime: e.target.value })} /></div></div><div><Label>Статус</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as Task['status'] })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">В ожидании</SelectItem><SelectItem value="in_progress">В работе</SelectItem><SelectItem value="done">Готово</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button><Button onClick={saveTask} disabled={!form.title.trim() || !form.dueDate} className="bg-[#1E5BEB] hover:bg-[#1749bb]"><CheckCircle2 className="h-4 w-4 mr-2" />Сохранить</Button></DialogFooter></DialogContent></Dialog>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить задачу?</AlertDialogTitle><AlertDialogDescription>Удаление нельзя отменить. Для временного хранения используйте архив.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={deleteTask} className="bg-rose-600 hover:bg-rose-700">Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
