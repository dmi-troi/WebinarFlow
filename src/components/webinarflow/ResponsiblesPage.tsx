'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import type { Responsible } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Users, Mail, MessageCircle, Video, CheckSquare, Link2 } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = { name: '', email: '', telegram: '', isActive: true };

function BindTelegramDialog({ responsible, onClose }: { responsible: Responsible; onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const res = await fetch('/api/telegram/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generate-bind-code', responsibleId: responsible.id }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.code) setCode(data.code);
    else toast.error('Ошибка генерации кода');
  };

  useEffect(() => { generate(); }, []);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Привязать Telegram для {responsible.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Чтобы получать личные уведомления, {responsible.name} должен написать боту этот код:
          </p>
          {code ? (
            <>
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-3xl font-mono font-bold tracking-widest text-[#1E5BEB]">{code}</p>
              </div>
              <ol className="text-sm space-y-1 text-muted-foreground list-decimal pl-4">
                <li>Откройте бота в Telegram</li>
                <li>Отправьте боту этот код: <b>{code}</b></li>
                <li>Бот подтвердит привязку</li>
              </ol>
              <p className="text-xs text-muted-foreground">Код одноразовый и действует до перезапуска сервера.</p>
            </>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              {loading ? 'Генерирую код...' : 'Ошибка'}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResponsiblesPage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  const [list, setList] = useState<Responsible[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bindFor, setBindFor] = useState<Responsible | null>(null);
  const [editing, setEditing] = useState<Responsible | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/responsibles').then((r) => r.json()).then(setList).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (r: Responsible) => {
    setEditing(r);
    setForm({ name: r.name, email: r.email || '', telegram: r.telegram || '', isActive: r.isActive });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const body = { ...form, email: form.email || null, telegram: form.telegram || null };
    if (editing) {
      await fetch('/api/responsibles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id: editing.id }) });
      toast.success('Обновлено');
    } else {
      await fetch('/api/responsibles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      toast.success('Добавлен');
    }
    setDialogOpen(false);
    triggerRefresh();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await fetch(`/api/responsibles?id=${deletingId}`, { method: 'DELETE' });
    toast.success('Удалён');
    setDeleteOpen(false);
    triggerRefresh();
  };

  const toggleActive = async (r: Responsible) => {
    await fetch('/api/responsibles', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: r.id, isActive: !r.isActive }) });
    toast.success(r.isActive ? 'Деактивирован' : 'Активирован');
    triggerRefresh();
  };

  // Telegram значение — если число, это правильный chat_id; если строка с буквами — это username (невалидный)
  const isTelegramBound = (tg: string | null) => !!tg && /^\d+$/.test(tg);

  if (loading) return <div className="p-4 md:p-6"><div className="h-64 animate-pulse bg-muted rounded-xl" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="hidden md:block">
          <h1 className="text-2xl font-bold">Ответственные</h1>
          <p className="text-muted-foreground">Управление участниками команды</p>
        </div>
        <Button onClick={openCreate} className="bg-[#1E5BEB] hover:bg-[#1E5BEB]/80">
          <Plus className="h-4 w-4 mr-2" />Добавить
        </Button>
      </div>

      {list.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Нет ответственных. Добавьте первого участника.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((r) => (
            <Card key={r.id} className={`${!r.isActive ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <Switch checked={r.isActive} onCheckedChange={() => toggleActive(r)} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {r.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" />{r.email}</div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  {isTelegramBound(r.telegram) ? (
                    <span className="text-green-600 font-medium">✓ Telegram привязан</span>
                  ) : r.telegram ? (
                    <span className="text-amber-600">⚠ Нужна привязка через бота</span>
                  ) : (
                    <span className="text-muted-foreground">Telegram не привязан</span>
                  )}
                </div>
                <div className="flex items-center gap-4 pt-2 border-t mt-2">
                  <div className="flex items-center gap-1.5 text-sm"><Video className="h-3.5 w-3.5 text-[#1E5BEB]" />{r._count?.webinars || 0}</div>
                  <div className="flex items-center gap-1.5 text-sm"><CheckSquare className="h-3.5 w-3.5 text-violet-500" />{r._count?.tasks || 0}</div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" />Изменить
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className={`flex-1 ${isTelegramBound(r.telegram) ? 'text-green-600 border-green-300' : 'text-[#1E5BEB] border-[#1E5BEB]/40'}`}
                    onClick={() => setBindFor(r)}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                    {isTelegramBound(r.telegram) ? 'Переприв.' : 'Привязать'}
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 md:h-8 md:w-8" onClick={() => { setDeletingId(r.id); setDeleteOpen(true); }}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {bindFor && <BindTelegramDialog responsible={bindFor} onClose={() => { setBindFor(null); triggerRefresh(); }} />}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Редактировать' : 'Новый ответственный'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Имя</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Имя" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
            <div>
              <Label>Telegram Chat ID (необязательно)</Label>
              <Input value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} placeholder="Используйте кнопку Привязать" />
              <p className="text-xs text-muted-foreground mt-1">Для уведомлений используйте кнопку «Привязать» в карточке — она получает правильный ID автоматически.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSave} disabled={!form.name} className="bg-[#1E5BEB] hover:bg-[#1E5BEB]/80">
              {editing ? 'Сохранить' : 'Добавить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Удалить ответственного?</AlertDialogTitle>
          <AlertDialogDescription>Задачи и вебинары не будут удалены, но отвязаны от этого участника.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
