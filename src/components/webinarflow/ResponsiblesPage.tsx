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
import { Plus, Pencil, Trash2, Users, Mail, MessageCircle, Video, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = { name: '', email: '', telegram: '', isActive: true };

export function ResponsiblesPage() {
  const refreshKey = useAppStore((s) => s.refreshKey);
  const triggerRefresh = useAppStore((s) => s.triggerRefresh);
  const [list, setList] = useState<Responsible[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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

  if (loading) return <div className="p-6"><div className="h-64 animate-pulse bg-muted rounded-xl" /></div>;

  return (
    <div className="p-6 max-w-6xl">
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
                {r.telegram && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><MessageCircle className="h-3.5 w-3.5" />@{r.telegram}</div>
                )}
                <div className="flex items-center gap-4 pt-2 border-t mt-2">
                  <div className="flex items-center gap-1.5 text-sm"><Video className="h-3.5 w-3.5 text-[#1E5BEB]" />{r._count?.webinars || 0}</div>
                  <div className="flex items-center gap-1.5 text-sm"><CheckSquare className="h-3.5 w-3.5 text-violet-500" />{r._count?.tasks || 0}</div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5 mr-1" />Изменить</Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setDeletingId(r.id); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editing ? 'Редактировать' : 'Новый ответственный'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Имя</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Имя" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
            <div><Label>Telegram (без @)</Label><Input value={form.telegram} onChange={(e) => setForm({ ...form, telegram: e.target.value })} placeholder="username" /></div>
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