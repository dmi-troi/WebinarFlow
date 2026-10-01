'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import type { Webinar, Responsible } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Archive, ArrowRight, CalendarDays, CheckCircle2, CircleAlert, Clock3,
  Download, ExternalLink, Import, ListChecks, Pencil, Plus, RefreshCw, Search,
  Sparkles, Trash2, Users, Video, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatInTimeZone } from 'date-fns-tz';
import { useAppStore } from '@/lib/store';
import { mskDateInputValue, mskInputToDate, mskTimeInputValue } from '@/lib/msk-time';
import { MtsLinkPanel } from '@/components/webinarflow/MtsLinkPanel';

const MSK = 'Europe/Moscow';

type MtsImportItem = {
  id: string;
  eventId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  status?: string;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  participantCount?: number;
  joinUrl?: string;
  recordUrl?: string;
  linkedWebinarId?: string;
};

type WebinarForm = {
  title: string;
  description: string;
  date: string;
  time: string;
  responsibleId: string;
  email: string;
  status: Webinar['status'];
};

const emptyWebinar: WebinarForm = {
  title: '', description: '', date: '', time: '', responsibleId: '', email: '', status: 'planned',
};

const statusLabels: Record<string, { label: string; className: string }> = {
  planned: { label: 'Планируется', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  active: { label: 'Активен', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  completed: { label: 'Проведён', className: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Отменён', className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

function readiness(webinar: Webinar) {
  const tasks = webinar.tasks || [];
  if (!tasks.length) return { percent: 0, done: 0, total: 0 };
  const done = tasks.filter((task) => task.status === 'done').length;
  return { percent: Math.round((done / tasks.length) * 100), done, total: tasks.length };
}

function formatWebinarDate(value: string) {
  return formatInTimeZone(value, MSK, 'd MMMM yyyy, HH:mm');
}

function ReadinessBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[150px]">
      <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full rounded-full bg-[#1E5BEB] transition-all" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[11px] tabular-nums font-medium text-slate-500 w-9 text-right">{percent}%</span>
    </div>
  );
}

export function WebinarsPage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [responsibles, setResponsibles] = useState<Responsible[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<Webinar | null>(null);
  const [selected, setSelected] = useState<Webinar | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<WebinarForm>(emptyWebinar);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showMts, setShowMts] = useState(false);
  const [mtsWebinars, setMtsWebinars] = useState<any[]>([]);
  const [mtsLoading, setMtsLoading] = useState(false);
  const [mtsError, setMtsError] = useState('');
  const [mtsImportOpen, setMtsImportOpen] = useState(false);
  const [mtsImportSearch, setMtsImportSearch] = useState('');
  const [mtsImportSaving, setMtsImportSaving] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [w, r] = await Promise.all([
        fetch('/api/webinars', { cache: 'no-store' }).then((response) => response.json()),
        fetch('/api/responsibles', { cache: 'no-store' }).then((response) => response.json()),
      ]);
      setWebinars(Array.isArray(w) ? w : []);
      setResponsibles(Array.isArray(r) ? r : []);
    } catch {
      toast.error('Не удалось загрузить вебинары');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const filteredWebinars = useMemo(() => webinars.filter((w) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || w.title.toLowerCase().includes(q) || (w.description || '').toLowerCase().includes(q);
    const matchesResponsible = responsibleFilter === 'all' || w.responsibleId === responsibleFilter;
    const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
    return matchesSearch && matchesResponsible && matchesStatus;
  }), [webinars, search, responsibleFilter, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyWebinar);
    setDialogOpen(true);
  };

  const openEdit = (w: Webinar) => {
    setEditing(w);
    setForm({
      title: w.title,
      description: w.description || '',
      date: mskDateInputValue(w.date),
      time: mskTimeInputValue(w.date),
      responsibleId: w.responsibleId || '',
      email: w.email || '',
      status: w.status,
    });
    setDialogOpen(true);
  };

  const openDetails = (w: Webinar) => {
    setSelected(w);
    setDetailOpen(true);
  };

  const handleSave = async () => {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      date: mskInputToDate(form.date, form.time || '12:00'),
      responsibleId: form.responsibleId || null,
      email: form.email.trim() || null,
      status: form.status,
    };
    try {
      const response = await fetch('/api/webinars', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...payload, id: editing.id } : payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось сохранить вебинар');
      }
      toast.success(editing ? 'Вебинар обновлён' : 'Вебинар создан');
      setDialogOpen(false);
      triggerRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка сохранения');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const response = await fetch(`/api/webinars?id=${deletingId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Не удалось удалить вебинар');
      toast.success('Вебинар удалён');
      setDeleteOpen(false);
      setDetailOpen(false);
      triggerRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка удаления');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const response = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'webinar', id }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Не удалось архивировать');
      }
      toast.success('Вебинар перемещён в архив');
      setDetailOpen(false);
      triggerRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка архивации');
    }
  };

  const handleGenerateTasks = async (id: string) => {
    try {
      const response = await fetch('/api/webinars/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webinarId: id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && response.status !== 409) throw new Error(data.error || 'Не удалось создать задачи');
      toast.success(response.status === 409 ? 'План задач уже существует' : `Создано задач: ${data.created || 0}`);
      triggerRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка генерации задач');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch('/api/webinars', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) throw new Error('Не удалось изменить статус');
      triggerRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка изменения статуса');
    }
  };

  const loadMts = async () => {
    setMtsLoading(true);
    setMtsError('');
    try {
      const response = await fetch('/api/mts-link?action=webinars', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось получить данные МТС Линк');
      setMtsWebinars(Array.isArray(data.webinars) ? data.webinars : []);
      return Array.isArray(data.webinars) ? data.webinars : [];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка МТС Линк';
      setMtsError(message);
      return [];
    } finally {
      setMtsLoading(false);
    }
  };

  const openMtsImport = async () => {
    setMtsImportSearch('');
    setMtsImportOpen(true);
    if (!mtsWebinars.length) await loadMts();
  };

  const findResponsibleId = (item: MtsImportItem) => {
    const ownerEmail = (item.ownerEmail || '').trim().toLowerCase();
    const ownerName = (item.ownerName || '').trim().toLowerCase();
    const exactEmail = ownerEmail
      ? responsibles.find((r) => r.isActive && (r.email || '').trim().toLowerCase() === ownerEmail)
      : null;
    if (exactEmail) return exactEmail.id;
    if (!ownerName) return '';
    const normalized = ownerName.replace(/\s+/g, ' ');
    const exactName = responsibles.find((r) => r.isActive && r.name.trim().toLowerCase() === normalized);
    return exactName?.id || '';
  };

  const importFromMts = async (item: MtsImportItem) => {
    if (item.linkedWebinarId) {
      toast.info('Это мероприятие уже добавлено в WebinarFlow');
      return;
    }
    setMtsImportSaving(item.id);
    try {
      const date = new Date(item.startDate);
      if (Number.isNaN(date.getTime())) throw new Error('МТС Линк не вернул корректную дату мероприятия');
      const response = await fetch('/api/webinars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          description: item.description || null,
          date: date.toISOString(),
          responsibleId: findResponsibleId(item) || null,
          status: 'planned',
          mtsLinkWebinarId: item.id || item.eventId || null,
          mtsLinkEventId: item.eventId || null,
          mtsLinkEventSessionId: item.id || null,
          mtsLinkUrl: item.joinUrl || item.recordUrl || null,
          mtsLinkLastSyncAt: new Date().toISOString(),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && data.webinarId) {
          toast.info('Этот вебинар уже есть в WebinarFlow');
        } else {
          throw new Error(data.error || 'Не удалось добавить вебинар');
        }
        return;
      }
      const planResponse = await fetch('/api/webinars/generate-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webinarId: data.id }),
      });
      const planData = await planResponse.json().catch(() => ({}));

      if (!planResponse.ok && planResponse.status !== 400) {
        throw new Error(planData.error || 'Вебинар создан, но план подготовки не удалось создать');
      }

      setMtsWebinars((items) => items.map((mts) => mts.id === item.id ? { ...mts, linkedWebinarId: data.id } : mts));
      setMtsImportOpen(false);

      const refreshedResponse = await fetch('/api/webinars', { cache: 'no-store' });
      const refreshedWebinars = await refreshedResponse.json().catch(() => []);
      const importedWebinar = Array.isArray(refreshedWebinars)
        ? refreshedWebinars.find((webinar: Webinar) => webinar.id === data.id)
        : null;

      if (importedWebinar) {
        setSelected(importedWebinar);
        setDetailOpen(true);
      }

      await loadData();
      triggerRefresh();

      if (planResponse.ok) {
        toast.success(`Вебинар добавлен. План подготовки создан: ${planData.created || 0} задач`);
      } else {
        toast.success('Вебинар добавлен, но план подготовки пока не создан');
        toast.info(planData.error || 'План можно создать позже вручную');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка импорта');
    } finally {
      setMtsImportSaving(null);
    }
  };

  const mtsImportItems = useMemo(() => {
    const q = mtsImportSearch.trim().toLowerCase();
    return (mtsWebinars as MtsImportItem[])
      .filter((item) => !q || item.title.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q) || (item.ownerName || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const linkedA = a.linkedWebinarId ? 1 : 0;
        const linkedB = b.linkedWebinarId ? 1 : 0;
        if (linkedA !== linkedB) return linkedA - linkedB;
        return new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime();
      })
      .slice(0, 80);
  }, [mtsWebinars, mtsImportSearch]);

  if (loading) {
    return <div className="p-4 md:p-7 bg-slate-50/70 min-h-full"><div className="max-w-[1500px] mx-auto space-y-4"><div className="h-20 rounded-2xl bg-white border animate-pulse" />{[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-white border animate-pulse" />)}</div></div>;
  }

  return (
    <div className="min-h-full bg-slate-50/70 p-4 md:p-7">
      <div className="max-w-[1500px] mx-auto space-y-5">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-[#1E5BEB] font-semibold">Мероприятия</div>
            <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-slate-950">Вебинары</h1>
            <p className="mt-1 text-sm text-slate-500">Подготовка, контроль задач и результаты в одном месте.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={openMtsImport}>
              <Import className="h-4 w-4 mr-2" /> Из МТС Линк
            </Button>
            <Button onClick={openCreate} className="bg-[#1E5BEB] hover:bg-[#1749bb]"><Plus className="h-4 w-4 mr-2" /> Вебинар</Button>
          </div>
        </header>

        <section className="rounded-2xl border bg-white shadow-sm p-4">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по названию и описанию" className="pl-9 bg-slate-50/60 border-slate-200" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full xl:w-44 bg-slate-50/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="planned">Планируется</SelectItem>
                <SelectItem value="active">Активен</SelectItem>
                <SelectItem value="completed">Проведён</SelectItem>
                <SelectItem value="cancelled">Отменён</SelectItem>
              </SelectContent>
            </Select>
            <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
              <SelectTrigger className="w-full xl:w-56 bg-slate-50/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все ответственные</SelectItem>
                {responsibles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">Всего: {filteredWebinars.length}</span>
            <span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-1">Планируется: {filteredWebinars.filter((w) => w.status === 'planned').length}</span>
            <span className="rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1">Активных: {filteredWebinars.filter((w) => w.status === 'active').length}</span>
          </div>
        </section>

        {filteredWebinars.length === 0 ? (
          <Card className="rounded-2xl border-dashed"><CardContent className="p-12 text-center">
            <Video className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="font-medium text-slate-800">Ничего не найдено</p>
            <p className="text-sm text-slate-500 mt-1">Измените фильтры или создайте новый вебинар.</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filteredWebinars.map((w) => {
              const st = statusLabels[w.status] || statusLabels.planned;
              const r = readiness(w);
              return (
                <Card key={w.id} className="rounded-2xl border-slate-200/80 shadow-sm hover:shadow-md transition-all bg-white overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-4 md:p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <button onClick={() => openDetails(w)} className="flex-1 min-w-0 text-left group">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-base md:text-lg text-slate-950 group-hover:text-[#1E5BEB] transition-colors truncate">{w.title}</h3>
                            <Badge variant="outline" className={st.className}>{st.label}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatWebinarDate(w.date)}</span>
                            <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{w.responsible?.name || 'Ответственный не назначен'}</span>
                          </div>
                          {w.description && <p className="mt-2 text-sm text-slate-500 line-clamp-2">{w.description}</p>}
                        </button>

                        <div className="lg:w-[240px] shrink-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Готовность</span>
                            <span className="text-xs text-slate-500">{r.total ? `${r.done}/${r.total} задач` : 'План не создан'}</span>
                          </div>
                          <ReadinessBar percent={r.percent} />
                          {!r.total && <button onClick={() => handleGenerateTasks(w.id)} className="mt-2 text-xs text-[#1E5BEB] hover:underline inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> Создать план подготовки</button>}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          <Select value={w.status} onValueChange={(value) => handleStatusChange(w.id, value)}>
                            <SelectTrigger className="w-36 h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="planned">Планируется</SelectItem>
                              <SelectItem value="active">Активен</SelectItem>
                              <SelectItem value="completed">Проведён</SelectItem>
                              <SelectItem value="cancelled">Отменён</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="icon" className="h-9 w-9" title="Открыть" onClick={() => openDetails(w)}><ArrowRight className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" className="h-9 w-9" title="Редактировать" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" className="h-9 w-9" title="В архив" onClick={() => handleArchive(w.id)}><Archive className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" className="h-9 w-9" title="Удалить" onClick={() => { setDeletingId(w.id); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 text-rose-500" /></Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><span className="text-[#E30611] font-bold">MTS</span><h2 className="font-semibold text-slate-950">Линк — данные</h2><Badge variant="outline" className="text-[10px]">только чтение</Badge></div>
              <p className="text-xs text-slate-500 mt-1">WebinarFlow только получает данные из МТС Линк. Никакие объекты там не создаются и не изменяются.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowMts((value) => !value); if (!showMts && mtsWebinars.length === 0) loadMts(); }}><ListChecks className="h-3.5 w-3.5 mr-1.5" />{showMts ? 'Скрыть' : 'Показать'}</Button>
              {showMts && <Button variant="outline" size="sm" onClick={loadMts} disabled={mtsLoading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${mtsLoading ? 'animate-spin' : ''}`} />Обновить</Button>}
            </div>
          </div>
          {showMts && <div className="p-5">
            {mtsError ? <div className="rounded-xl bg-rose-50 border border-rose-100 p-4 text-sm text-rose-700 flex items-start gap-2"><CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />{mtsError}</div>
              : mtsLoading ? <div className="py-8 text-center text-sm text-slate-500"><RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />Получаю данные…</div>
                : mtsWebinars.length === 0 ? <div className="py-8 text-center text-sm text-slate-500">Нет данных. Проверьте API-ключ в Настройках.</div>
                  : <div className="space-y-2">{mtsWebinars.map((w: any) => <div key={`${w.eventId}-${w.id}`} className="rounded-xl border bg-slate-50/60 p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="min-w-0"><div className="font-medium text-sm text-slate-900 truncate">{w.title || 'Без названия'}</div><div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">{w.startDate && <span>{formatInTimeZone(w.startDate, MSK, 'd MMM yyyy, HH:mm')}</span>}{w.ownerName && <span>{w.ownerName}</span>}{w.participantCount > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{w.participantCount}</span>}{w.status && <Badge variant="outline" className="text-[10px]">{w.status}</Badge>}</div></div>
                    <div className="flex gap-2 shrink-0">{w.joinUrl && <a href={w.joinUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="h-8 text-xs"><ExternalLink className="h-3 w-3 mr-1" />Подключение</Button></a>}{w.recordUrl && <a href={w.recordUrl} target="_blank" rel="noopener noreferrer"><Button variant="outline" size="sm" className="h-8 text-xs"><Download className="h-3 w-3 mr-1" />Запись</Button></a>}</div>
                  </div>)}</div>}
          </div>}
        </section>
      </div>

      <Dialog open={mtsImportOpen} onOpenChange={setMtsImportOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>Добавить вебинар из МТС Линк</DialogTitle>
            <DialogDescription>Выберите существующее мероприятие МТС Линк. WebinarFlow создаст только локальную запись и сохранит связь с МТС Линк. Никаких изменений в МТС Линк не выполняется.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                value={mtsImportSearch}
                onChange={(e) => setMtsImportSearch(e.target.value)}
                placeholder="Поиск по названию, описанию или владельцу"
                className="pl-9"
              />
            </div>
            {mtsLoading ? (
              <div className="py-12 text-center text-sm text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                Загружаю мероприятия из МТС Линк…
              </div>
            ) : mtsError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{mtsError}</div>
            ) : mtsImportItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">Ничего не найдено.</div>
            ) : (
              <div className="space-y-2">
                {mtsImportItems.map((item) => (
                  <div key={item.eventId + '-' + item.id} className="rounded-xl border bg-white p-3 flex flex-col md:flex-row md:items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-medium text-sm text-slate-900">{item.title || 'Без названия'}</div>
                        {item.linkedWebinarId ? <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">Уже добавлен</Badge> : <Badge variant="outline" className="text-[10px] border-rose-200 text-rose-700 bg-rose-50">МТС Линк</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                        {item.startDate && <span>{formatInTimeZone(item.startDate, MSK, 'd MMM yyyy, HH:mm')}</span>}
                        {item.ownerName && <span>{item.ownerName}</span>}
                        {item.ownerEmail && <span>{item.ownerEmail}</span>}
                        {(item.participantCount ?? 0) > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{item.participantCount}</span>}
                      </div>
                      {item.description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</div>}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => importFromMts(item)}
                      disabled={Boolean(item.linkedWebinarId) || mtsImportSaving === item.id}
                      className="shrink-0 bg-[#1E5BEB] hover:bg-[#1749bb]"
                    >
                      {mtsImportSaving === item.id ? <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Import className="h-3.5 w-3.5 mr-1.5" />}
                      {item.linkedWebinarId ? 'Добавлен' : 'Добавить и создать план'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMtsImportOpen(false)}>Закрыть</Button>
            <Button variant="outline" onClick={() => loadMts()} disabled={mtsLoading}><RefreshCw className="h-4 w-4 mr-2" />Обновить список</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (() => { const r = readiness(selected); return <>
            <DialogHeader>
              <div className="flex flex-wrap gap-2 mb-2"><Badge variant="outline" className={statusLabels[selected.status]?.className || ''}>{statusLabels[selected.status]?.label || selected.status}</Badge>{selected.mtsLinkWebinarId && <Badge variant="outline">MTS связан</Badge>}</div>
              <DialogTitle className="text-xl">{selected.title}</DialogTitle>
              <DialogDescription>{formatWebinarDate(selected.date)} · {selected.responsible?.name || 'Ответственный не назначен'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              {selected.description && <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 whitespace-pre-wrap">{selected.description}</div>}
              <div className="rounded-2xl border p-4">
                <div className="flex items-center justify-between"><div><p className="font-semibold text-slate-900">Готовность мероприятия</p><p className="text-xs text-slate-500 mt-1">План подготовки по связанным задачам</p></div><div className="text-2xl font-bold text-[#1E5BEB]">{r.percent}%</div></div>
                <ReadinessBar percent={r.percent} />
                {r.total === 0 ? <div className="mt-3 rounded-xl bg-amber-50 text-amber-800 p-3 text-sm flex items-center gap-2"><CircleAlert className="h-4 w-4" />Для вебинара ещё не создан план задач.</div> : <div className="mt-3 text-xs text-slate-500">Выполнено {r.done} из {r.total} задач.</div>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wide"><Users className="h-3.5 w-3.5" />Ответственный</div><div className="font-medium mt-2">{selected.responsible?.name || 'Не назначен'}</div>{selected.email && <div className="text-xs text-slate-500 mt-1">{selected.email}</div>}</div>
                <div className="rounded-xl border p-4"><div className="flex items-center gap-2 text-slate-500 text-xs uppercase tracking-wide"><Clock3 className="h-3.5 w-3.5" />Дата проведения</div><div className="font-medium mt-2">{formatWebinarDate(selected.date)} МСК</div></div>
              </div>
              {selected.mtsLinkUrl && <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4"><div className="flex items-center gap-2 font-semibold text-slate-900"><span className="text-[#E30611]">MTS</span> Линк</div><p className="text-xs text-slate-500 mt-1">Сохранённая ссылка из данных WebinarFlow. Данные в МТС Линк не изменяются.</p><a href={selected.mtsLinkUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#1E5BEB] hover:underline inline-flex items-center gap-1 mt-2">Открыть ссылку <ExternalLink className="h-3 w-3" /></a></div>}
              <MtsLinkPanel webinar={selected} onLinked={() => { setDetailOpen(false); loadData(); triggerRefresh(); }} />
            </div>
            <DialogFooter className="flex flex-wrap gap-2 sm:justify-between"><div className="flex gap-2"><Button variant="outline" onClick={() => { setDetailOpen(false); openEdit(selected); }}><Pencil className="h-4 w-4 mr-2" />Изменить</Button><Button variant="outline" onClick={() => handleGenerateTasks(selected.id)}><Zap className="h-4 w-4 mr-2 text-amber-500" />План задач</Button></div><div className="flex gap-2"><Button variant="outline" onClick={() => handleArchive(selected.id)}><Archive className="h-4 w-4 mr-2" />В архив</Button><Button variant="destructive" onClick={() => { setDeletingId(selected.id); setDeleteOpen(true); }}><Trash2 className="h-4 w-4 mr-2" />Удалить</Button></div></DialogFooter>
          </>; })()}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Редактировать вебинар' : 'Новый вебинар'}</DialogTitle><DialogDescription>Дата и время указываются по Москве (МСК).</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Название</Label><Input className="mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Название вебинара" /></div>
            <div><Label>Описание</Label><Textarea className="mt-1" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Краткое описание или заметки" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><Label>Дата</Label><Input className="mt-1" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div><div><Label>Время</Label><Input className="mt-1" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></div></div>
            <div><Label>Ответственный</Label><Select value={form.responsibleId} onValueChange={(value) => setForm({ ...form, responsibleId: value })}><SelectTrigger className="mt-1"><SelectValue placeholder="Выбрать ответственного" /></SelectTrigger><SelectContent>{responsibles.filter((r) => r.isActive).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Email для мероприятия</Label><Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
            <div><Label>Статус</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as Webinar['status'] })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="planned">Планируется</SelectItem><SelectItem value="active">Активен</SelectItem><SelectItem value="completed">Проведён</SelectItem><SelectItem value="cancelled">Отменён</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button><Button onClick={handleSave} disabled={!form.title.trim() || !form.date} className="bg-[#1E5BEB] hover:bg-[#1749bb]"><CheckCircle2 className="h-4 w-4 mr-2" />{editing ? 'Сохранить' : 'Создать'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить вебинар?</AlertDialogTitle><AlertDialogDescription>Вебинар и связанные с ним задачи будут удалены без возможности восстановления. Для безопасного удаления используйте архив.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">Удалить</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
