'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Save, Send, CheckCircle2, AlertCircle, Zap, Link2, Unlink, MessageSquare, Clock } from 'lucide-react';

interface AppSettings {
  taskPeriods: { unisender: number; mtsLink: number; reminder: number; eventDay: number };
  taskTypeNames: { unisender: string; mtsLink: string; reminder: string; eventDay: string; general: string };
  taskShiftDirection: string;
  maxShiftDays: string;
  autoRecalc: string;
}

const defaults: AppSettings = {
  taskPeriods: { unisender: 3, mtsLink: 1, reminder: 1, eventDay: 0 },
  taskTypeNames: { unisender: 'Юнисендер', mtsLink: 'МТС Link', reminder: 'Напоминание', eventDay: 'День мероприятия', general: 'Общая' },
  taskShiftDirection: 'back',
  maxShiftDays: '7',
  autoRecalc: 'true',
};

export function SettingsPage() {
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const [s, setS] = useState<AppSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [tgSending, setTgSending] = useState(false);
  const [tgStatus, setTgStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [tgEnabled, setTgEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [mtsApiKey, setMtsApiKey] = useState('');
  const [mtsBaseUrl, setMtsBaseUrl] = useState('https://webinar.mts-link.ru/api/v1');
  const [mtsStatus, setMtsStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [loginPw, setLoginPw] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [cronTesting, setCronTesting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/settings').then((r) => r.json()),
      fetch('/api/telegram').then((r) => r.json()),
    ]).then(([data, tg]) => {
      try {
        setS({
          taskPeriods: { ...defaults.taskPeriods, ...JSON.parse(data.taskPeriods || '{}') },
          taskTypeNames: { ...defaults.taskTypeNames, ...JSON.parse(data.taskTypeNames || '{}') },
          taskShiftDirection: data.taskShiftDirection || 'back',
          maxShiftDays: data.maxShiftDays || '7',
          autoRecalc: data.autoRecalc || 'true',
        });
        setTgToken(data.telegramBotToken || '');
        setTgChatId(data.telegramChatId || '');
        setTgEnabled(data.telegramEnabled === 'true');
        setEmailEnabled(data.emailEnabled === 'true');
        setMtsApiKey(data.mtsLinkApiKey || '');
        setMtsBaseUrl(data.mtsLinkBaseUrl || 'https://webinar.mts-link.ru/api/v1');
        setHasPassword(!!data.loginPassword);
      } catch { /* keep defaults */ }
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updatePeriod = (key: keyof AppSettings['taskPeriods'], val: string) => {
    setS((p) => ({ ...p, taskPeriods: { ...p.taskPeriods, [key]: parseInt(val) || 0 } }));
  };

  const updateTypeName = (key: keyof AppSettings['taskTypeNames'], val: string) => {
    setS((p) => ({ ...p, taskTypeNames: { ...p.taskTypeNames, [key]: val } }));
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskPeriods: JSON.stringify(s.taskPeriods),
        taskTypeNames: JSON.stringify(s.taskTypeNames),
        taskShiftDirection: s.taskShiftDirection,
        maxShiftDays: s.maxShiftDays,
        autoRecalc: s.autoRecalc,
        telegramBotToken: tgToken,
        telegramChatId: tgChatId,
        telegramEnabled: String(tgEnabled),
        emailEnabled: String(emailEnabled),
        mtsLinkApiKey: mtsApiKey,
        mtsLinkBaseUrl: mtsBaseUrl,
        loginPassword: loginPw || null,
      }),
    });
    toast.success('Настройки сохранены');
    setSaving(false);
  };

  const handleTestTg = async () => {
    setTgSending(true);
    setTgStatus('idle');
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: tgChatId,
          message: 'WebinarFlow тест - уведомления работают!',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTgStatus('ok');
        toast.success('Сообщение отправлено в Telegram');
      } else {
        setTgStatus('error');
        toast.error(data.error || 'Ошибка отправки');
      }
    } catch {
      setTgStatus('error');
      toast.error('Не удалось отправить');
    }
    setTgSending(false);
  };

  if (loading) return <div className="p-4 md:p-6"><div className="h-64 animate-pulse bg-muted rounded-xl" /></div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl">
      <div className="mb-6 hidden md:block">
        <h1 className="text-2xl font-bold">Настройки</h1>
        <p className="text-muted-foreground">Параметры системы управления вебинарами</p>
      </div>

      {/* Access password */}
      <Card className="mb-4 border-[#1E5BEB]/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">&#128274;</span> Доступ к системе
          </CardTitle>
          <CardDescription>Задайте пароль для входа в WebinarFlow. Один пароль на всех.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Пароль для входа</Label>
            <Input
              type="text"
              value={loginPw}
              onChange={(e) => setLoginPw(e.target.value)}
              placeholder={hasPassword ? 'Оставьте пустым, чтобы не менять' : 'Задайте пароль'}
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {hasPassword ? 'Пароль установлен. Введите новый, чтобы сменить.' : 'Пока не задан — вход открыт для всех.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Card */}
      <Card className="mb-4 border-[#1E5BEB]/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">&#9993;</span> Telegram уведомления
          </CardTitle>
          <CardDescription>Настройте бота для получения напоминаний о задачах в Telegram</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={tgEnabled} onCheckedChange={setTgEnabled} />
            <Label>Включить уведомления</Label>
          </div>
          <div>
            <Label>Bot Token</Label>
            <Input
              type="password"
              value={tgToken}
              onChange={(e) => setTgToken(e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Получите у{' '}<a href="https://t.me/BotFather" target="_blank" className="text-[#1E5BEB] underline">@BotFather</a> в Telegram
            </p>
          </div>
          <div>
            <Label>Chat ID (группы или личный)</Label>
            <Input
              value={tgChatId}
              onChange={(e) => setTgChatId(e.target.value)}
              placeholder="-1001234567890"
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Для получения ID напишите {' '}
              <a href={`https://t.me/${tgToken ? tgToken.split(':')[0] : 'your_bot'}`} target="_blank" className="text-[#1E5BEB] underline">
                вашему боту
              </a>{' '}
              и перешлите сообщение в {' '}
              <a href="https://t.me/getmyid_bot" target="_blank" className="text-[#1E5BEB] underline">@getmyid_bot</a>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleTestTg}
              disabled={tgSending || !tgToken || !tgChatId}
              variant="outline"
              size="sm"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {tgSending ? 'Отправка...' : 'Тестовая рассылка'}
            </Button>
            {tgStatus === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {tgStatus === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
          </div>
        </CardContent>
      </Card>

      {/* Email Card */}
      <Card className="mb-4 border-[#1E5BEB]/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">📧</span> Email уведомления
          </CardTitle>
          <CardDescription>Дублировать утреннюю сводку и напоминания на почту (через Resend)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
            <Label>Включить email-уведомления</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Письма приходят на адрес, указанный у ответственного в разделе{' '}
            <button type="button" onClick={() => setCurrentPage('responsibles')} className="text-[#1E5BEB] underline">
              «Ответственные»
            </button>.
            API-ключ Resend настраивается переменной окружения на сервере (RESEND_API_KEY уже задана).
          </p>
        </CardContent>
      </Card>

      {/* Auto Notifications */}
      <Card className="mb-4 border-[#1E5BEB]/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-5 w-5 text-[#1E5BEB]" /> Автоматические уведомления</CardTitle>
          <CardDescription>Утренняя сводка и напоминания за 30 минут до дедлайна</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
            <div><b>Утро (9:00–10:00 МСК)</b> — сводка по задачам на сегодня в Telegram</div>
            <div><b>За 30 мин до дедлайна</b> — персональное напоминание ответственному</div>
          </div>
          <div className="border-t pt-4">
            <Label className="mb-2 block">Внешний cron (обязателен)</Label>
            <p className="text-xs text-muted-foreground mb-2">Зарегистрируйтесь на <a href="https://cron-job.org" target="_blank" className="text-[#1E5BEB] underline">cron-job.org</a> (бесплатно) и создайте задачу:</p>
            <div className="bg-muted rounded-lg p-3 font-mono text-xs space-y-1">
              <div><b>URL:</b> https://ваш-сайт.onrender.com/api/notifications/cron</div>
              <div><b>Интервал:</b> Каждые 5 минут</div>
              <div><b>Метод:</b> GET</div>
            </div>
          </div>
          <Button onClick={async () => { setCronTesting(true); try { const r = await fetch('/api/notifications/cron'); const d = await r.json(); toast.success(JSON.stringify(d)); } catch { toast.error('Ошибка'); } setCronTesting(false); }} disabled={cronTesting || !tgToken} variant="outline" size="sm">
            <Zap className="h-3.5 w-3.5 mr-1.5" />{cronTesting ? 'Проверка...' : 'Тест cron сейчас'}
          </Button>
        </CardContent>
      </Card>

      {/* MTS Link Card */}
      <Card className="mb-4 border-[#1E5BEB]/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <span className="text-xl">&#128279;</span> МТС Линк
          </CardTitle>
          <CardDescription>Создавайте вебинары в МТС Линк прямо из WebinarFlow</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>API ключ</Label>
            <Input
              type="password"
              value={mtsApiKey}
              onChange={(e) => setMtsApiKey(e.target.value)}
              placeholder="Вставьте API ключ из МТС Линк"
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Личный кабинет МТС Линк {'>'} Бизнес {'>'} API/Webhooks
            </p>
          </div>
          <div>
            <Label>Base URL</Label>
            <Input
              value={mtsBaseUrl}
              onChange={(e) => setMtsBaseUrl(e.target.value)}
              placeholder="https://webinar.mts-link.ru/api/v1"
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Для on-premise версии укажите ваш адрес
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={async () => {
                setMtsStatus('idle');
                try {
                  const res = await fetch('/api/mts-link');
                  const data = await res.json();
                  if (data.configured) {
                    setMtsStatus('ok');
                    toast.success(`Подключено: ${data.baseUrl}`);
                  } else {
                    setMtsStatus('error');
                    toast.error('API ключ не задан');
                  }
                } catch {
                  setMtsStatus('error');
                  toast.error('Ошибка проверки');
                }
              }}
              variant="outline"
              size="sm"
            >
              Проверить подключение
            </Button>
            {mtsStatus === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {mtsStatus === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Периоды создания задач (дней до вебинара)</CardTitle>
        <CardDescription>За сколько дней до вебинара автоматически создавать задачи</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(['unisender', 'mtsLink', 'reminder', 'eventDay'] as const).map((key) => (
            <div key={key}>
              <Label>{s.taskTypeNames[key] || key}</Label>
              <Input type="number" min={0} value={s.taskPeriods[key]} onChange={(e) => updatePeriod(key, e.target.value)} className="mt-1" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Названия типов задач</CardTitle>
        <CardDescription>Кастомизация названий для каждого типа задачи</CardDescription></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(Object.keys(s.taskTypeNames) as (keyof AppSettings['taskTypeNames'])[]).map((key) => (
            <div key={key}>
              <Label>{key}</Label>
              <Input value={s.taskTypeNames[key]} onChange={(e) => updateTypeName(key, e.target.value)} className="mt-1" />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">Параметры переноса</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Направление переноса задач при изменении даты вебинара</Label>
            <RadioGroup value={s.taskShiftDirection} onValueChange={(v) => setS((p) => ({ ...p, taskShiftDirection: v }))} className="flex gap-4">
              <div className="flex items-center gap-2"><RadioGroupItem value="back" id="back" /><Label htmlFor="back">Назад</Label></div>
              <div className="flex items-center gap-2"><RadioGroupItem value="forward" id="forward" /><Label htmlFor="forward">Вперёд</Label></div>
            </RadioGroup>
          </div>
          <div>
            <Label>Максимальный сдвиг (дней)</Label>
            <Input type="number" min={1} value={s.maxShiftDays} onChange={(e) => setS((p) => ({ ...p, maxShiftDays: e.target.value }))} className="mt-1 w-32" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={s.autoRecalc === 'true'} onCheckedChange={(v) => setS((p) => ({ ...p, autoRecalc: String(v) }))} />
            <Label>Автоматический пересчёт задач при изменении даты вебинара</Label>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="bg-[#1E5BEB] hover:bg-[#1E5BEB]/80">
        <Save className="h-4 w-4 mr-2" />{saving ? 'Сохранение...' : 'Сохранить все настройки'}
      </Button>
    </div>
  );
}
