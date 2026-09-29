'use client';

/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Save, Send, CheckCircle2, AlertCircle, Zap, Link2, Clock, Upload, Trash2, Image as ImageIcon, ShieldCheck, Copy, KeyRound } from 'lucide-react';
import { BrandLogo, notifyBrandLogoUpdated } from './BrandLogo';

interface AppSettings {
  taskPeriods: { unisender: number; mtsLink: number; reminder: number; eventDay: number; sms: number };
  taskTypeNames: { unisender: string; mtsLink: string; reminder: string; eventDay: string; sms: string; general: string };
  taskShiftDirection: string;
  maxShiftDays: string;
  autoRecalc: string;
  brandingLogo: string;
}

const defaults: AppSettings = {
  taskPeriods: { unisender: 3, mtsLink: 1, reminder: 1, eventDay: 0, sms: 0 },
  taskTypeNames: { unisender: 'Юнисендер', mtsLink: 'МТС Link', reminder: 'Напоминание', eventDay: 'День мероприятия', sms: 'SMS', general: 'Общая' },
  taskShiftDirection: 'back',
  maxShiftDays: '7',
  autoRecalc: 'true',
  brandingLogo: '',
};

async function optimizeLogo(file: File): Promise<string> {
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) throw new Error('Поддерживаются PNG, JPG и WebP.');
  if (file.size > 2 * 1024 * 1024) throw new Error('Файл должен быть не больше 2 МБ.');

  const bitmap = await createImageBitmap(file);
  const maxWidth = 1000;
  const maxHeight = 300;
  const ratio = Math.min(maxWidth / bitmap.width, maxHeight / bitmap.height, 1);
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Не удалось подготовить изображение.');
  context.clearRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const result = canvas.toDataURL('image/webp', 0.9);
  if (result.length > 900_000) throw new Error('Получившийся логотип слишком большой. Используйте более простой файл.');
  return result;
}

export function SettingsPage() {
  const [s, setS] = useState<AppSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [tgSending, setTgSending] = useState(false);
  const [tgStatus, setTgStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgConfigured, setTgConfigured] = useState(false);
  const [mtsApiKey, setMtsApiKey] = useState('');
  const [mtsBaseUrl, setMtsBaseUrl] = useState('https://webinar.mts-link.ru/api/v1');
  const [mtsStatus, setMtsStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [mtsConfigured, setMtsConfigured] = useState(false);
  const [loginPw, setLoginPw] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [cronTesting, setCronTesting] = useState(false);
  const [cronSecret, setCronSecret] = useState('');
  const [cronSecretSet, setCronSecretSet] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/settings', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/telegram', { cache: 'no-store' }).then((r) => r.json()),
    ]).then(([data]) => {
      try {
        setS({
          taskPeriods: { ...defaults.taskPeriods, ...JSON.parse(data.taskPeriods || '{}') },
          taskTypeNames: { ...defaults.taskTypeNames, ...JSON.parse(data.taskTypeNames || '{}') },
          taskShiftDirection: data.taskShiftDirection || 'back',
          maxShiftDays: data.maxShiftDays || '7',
          autoRecalc: data.autoRecalc || 'true',
          brandingLogo: typeof data.brandingLogo === 'string' ? data.brandingLogo : '',
        });
        setTgToken('');
        setTgConfigured(data.telegramBotTokenSet === 'true');
        setTgChatId(data.telegramChatId || '');
        setTgEnabled(data.telegramEnabled === 'true');
        setMtsApiKey('');
        setMtsConfigured(data.mtsLinkApiKeySet === 'true');
        setMtsBaseUrl(data.mtsLinkBaseUrl || 'https://webinar.mts-link.ru/api/v1');
        setHasPassword(data.loginPasswordSet === 'true');
        setCronSecretSet(data.cronSecretSet === 'true');
      } catch {
        // Keep safe defaults if an older settings record contains malformed JSON.
      }
    }).catch(() => toast.error('Не удалось загрузить настройки')).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updatePeriod = (key: keyof AppSettings['taskPeriods'], val: string) => {
    setS((p) => ({ ...p, taskPeriods: { ...p.taskPeriods, [key]: parseInt(val, 10) || 0 } }));
  };

  const updateTypeName = (key: keyof AppSettings['taskTypeNames'], val: string) => {
    setS((p) => ({ ...p, taskTypeNames: { ...p.taskTypeNames, [key]: val } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        taskPeriods: JSON.stringify(s.taskPeriods),
        taskTypeNames: JSON.stringify(s.taskTypeNames),
        taskShiftDirection: s.taskShiftDirection,
        maxShiftDays: s.maxShiftDays,
        autoRecalc: s.autoRecalc,
        telegramChatId: tgChatId,
        telegramEnabled: String(tgEnabled),
        mtsLinkBaseUrl: mtsBaseUrl,
        brandingLogo: s.brandingLogo,
      };
      if (tgToken.trim()) payload.telegramBotToken = tgToken.trim();
      if (mtsApiKey.trim()) payload.mtsLinkApiKey = mtsApiKey.trim();
      if (loginPw.trim()) payload.loginPassword = loginPw;
      const response = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Сервер не принял настройки'); }
      if (loginPw) { setHasPassword(true); setLoginPw(''); }
      if (tgToken) { setTgConfigured(true); setTgToken(''); }
      if (mtsApiKey) { setMtsConfigured(true); setMtsApiKey(''); }
      notifyBrandLogoUpdated();
      toast.success('Настройки сохранены');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Не удалось сохранить настройки'); }
    finally { setSaving(false); }
  };

  const generateCronSecret = async () => {
    setCronTesting(true);
    try { const r = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generateCronSecret' }) }); const data = await r.json(); if (!r.ok || !data.cronSecret) throw new Error(data.error || 'Ошибка'); setCronSecret(data.cronSecret); setCronSecretSet(true); toast.success('Секрет создан'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Ошибка'); }
    finally { setCronTesting(false); }
  };

  const revealCronSecret = async () => {
    setCronTesting(true);
    try { const r = await fetch('/api/settings?reveal=cronSecret', { cache: 'no-store' }); const data = await r.json(); if (!r.ok || !data.cronSecret) throw new Error(data.error || 'Секрет не создан'); setCronSecret(data.cronSecret); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Ошибка'); }
    finally { setCronTesting(false); }
  };

  const testCronNow = async () => {
    if (!cronSecret) return;
    setCronTesting(true);
    try { const r = await fetch('/api/notifications/cron', { headers: { Authorization: `Bearer ${cronSecret}` } }); const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Ошибка'); toast.success('Cron отвечает корректно'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Ошибка cron'); }
    finally { setCronTesting(false); }
  };

  const handleLogoPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLogoBusy(true);
    try {
      const logo = await optimizeLogo(file);
      setS((p) => ({ ...p, brandingLogo: logo }));
      toast.success('Логотип загружен. Не забудьте сохранить настройки.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Не удалось загрузить логотип');
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = () => {
    setS((p) => ({ ...p, brandingLogo: '' }));
    toast('Логотип будет заменён на стандартный после сохранения.');
  };

  const handleTestTg = async () => {
    setTgSending(true);
    setTgStatus('idle');
    try {
      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: tgChatId, message: 'WebinarFlow тест - уведомления работают!' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка отправки');
      setTgStatus('ok');
      toast.success('Сообщение отправлено в Telegram');
    } catch (error) {
      setTgStatus('error');
      toast.error(error instanceof Error ? error.message : 'Не удалось отправить');
    } finally {
      setTgSending(false);
    }
  };

  if (loading) return <div className="p-4 md:p-7 bg-slate-50/70 min-h-full"><div className="max-w-3xl mx-auto h-96 animate-pulse bg-white border rounded-2xl" /></div>;

  return (
    <div className="min-h-full bg-slate-50/70 p-4 md:p-7">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="mb-7 hidden md:block">
          <div className="text-xs uppercase tracking-[0.16em] text-[#1E5BEB] font-semibold">Конфигурация</div>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-slate-950">Настройки</h1>
          <p className="text-sm text-slate-500 mt-1">Брендинг, уведомления и правила подготовки. Существующие данные вебинаров и задач не изменяются.</p>
        </div>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><ImageIcon className="h-5 w-5 text-[#1E5BEB]" /> Брендинг</CardTitle>
            <CardDescription>Загрузите свой логотип. Он будет использоваться в боковом меню, на мобильном экране и при входе.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border bg-slate-50 p-5 flex flex-col md:flex-row gap-6 md:items-center">
              <div className="w-full md:w-[280px] h-24 rounded-xl bg-[#08182f] flex items-center justify-center overflow-hidden border border-white/10">
                {s.brandingLogo ? (
                  <img src={s.brandingLogo} alt="Предпросмотр логотипа" className="max-h-16 max-w-[230px] object-contain" />
                ) : (
                  <BrandLogo className="max-h-12 max-w-[190px]" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">Собственный логотип</p>
                <p className="text-xs text-slate-500 mt-1">PNG, JPG или WebP, до 2 МБ. Система автоматически уменьшит изображение до разумного размера и сохранит его в настройках.</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <label className="inline-flex">
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoPick} className="sr-only" disabled={logoBusy} />
                    <span className="inline-flex items-center justify-center rounded-lg bg-[#1E5BEB] text-white text-sm font-medium px-3 py-2 cursor-pointer hover:bg-[#1749bb] disabled:opacity-50">
                      <Upload className="h-4 w-4 mr-2" />{logoBusy ? 'Обработка...' : 'Загрузить логотип'}
                    </span>
                  </label>
                  {s.brandingLogo && <Button type="button" variant="outline" size="sm" onClick={removeLogo}><Trash2 className="h-4 w-4 mr-2" /> Убрать</Button>}
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Логотип хранится как настройка приложения; отдельная миграция таблиц не требуется.</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">🔒 Доступ к системе</CardTitle>
            <CardDescription>Задайте пароль для входа в WebinarFlow. Один пароль на всех.</CardDescription>
          </CardHeader>
          <CardContent>
            <Label>Новый пароль</Label>
            <Input type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} placeholder={hasPassword ? 'Оставьте пустым, чтобы не менять' : 'Задайте пароль'} className="mt-1 font-mono text-sm" />
            <p className="text-xs text-muted-foreground mt-1">{hasPassword ? 'Пароль установлен. Введите новый, чтобы сменить.' : 'Пока не задан — вход открыт для всех.'}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">✉ Telegram уведомления</CardTitle>
            <CardDescription>Настройте бота для получения напоминаний о задачах в Telegram.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3"><Switch checked={tgEnabled} onCheckedChange={setTgEnabled} /><Label>Включить уведомления</Label></div>
            <div><Label>Bot Token</Label><Input type="password" value={tgToken} onChange={(e) => setTgToken(e.target.value)} placeholder={tgConfigured ? 'Оставьте пустым, чтобы сохранить текущий токен' : '123456:ABC-DEF...'} className="mt-1 font-mono text-sm" /><p className="text-xs text-muted-foreground mt-1">Получите у <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-[#1E5BEB] underline">@BotFather</a> в Telegram.</p></div>
            <div><Label>Chat ID (группы или личный)</Label><Input value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} placeholder="-1001234567890" className="mt-1 font-mono text-sm" /></div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={async () => { try { const baseUrl = window.location.origin; const res = await fetch('/api/telegram/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set-webhook', baseUrl }) }); const d = await res.json(); if (!res.ok || !d.ok) throw new Error(d.error || 'Ошибка'); toast.success('Вебхук установлен'); } catch (error) { toast.error(error instanceof Error ? error.message : 'Ошибка установки вебхука'); } }} variant="outline" size="sm" disabled={!tgConfigured}><Link2 className="h-3.5 w-3.5 mr-1.5" /> Установить вебхук</Button>
              <Button onClick={handleTestTg} disabled={tgSending || !tgConfigured || !tgChatId} variant="outline" size="sm"><Send className="h-3.5 w-3.5 mr-1.5" />{tgSending ? 'Отправка...' : 'Тестовая рассылка'}</Button>
              {tgStatus === 'ok' && <CheckCircle2 className="h-4 w-4 text-emerald-500 self-center" />}{tgStatus === 'error' && <AlertCircle className="h-4 w-4 text-red-500 self-center" />}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="h-5 w-5 text-[#1E5BEB]" /> Автоматические уведомления</CardTitle><CardDescription>Утренняя сводка и напоминания за 30 минут до дедлайна.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 text-sm space-y-2"><div><b>Утро (9:00–10:00 МСК)</b> — сводка по задачам на сегодня в Telegram</div><div><b>За 30 минут до дедлайна</b> — персональное напоминание ответственному</div></div>
            <div className="border-t pt-4"><Label className="mb-2 block">Безопасный cron</Label><p className="text-xs text-muted-foreground mb-2">Создайте секрет ниже. В cron-job.org нужен заголовок <b>Authorization: Bearer &lt;секрет&gt;</b>. Один и тот же секрет используйте только для этого endpoint.</p><div className="bg-slate-100 rounded-xl p-3 font-mono text-xs space-y-1"><div><b>URL:</b> https://ваш-сайт.onrender.com/api/notifications/cron</div><div><b>Интервал:</b> каждые 5 минут</div><div><b>Метод:</b> GET</div></div><div className="flex flex-wrap gap-2 mt-3">{cronSecret ? <Button onClick={revealCronSecret} disabled={cronTesting} variant="outline" size="sm"><KeyRound className="h-3.5 w-3.5 mr-1.5"/>Показать текущий</Button> : <Button onClick={cronSecretSet ? revealCronSecret : generateCronSecret} disabled={cronTesting} variant="outline" size="sm"><KeyRound className="h-3.5 w-3.5 mr-1.5"/>{cronSecretSet ? 'Показать секрет' : 'Создать секрет'}</Button>}{cronSecret&&<Button onClick={async()=>{await navigator.clipboard.writeText(cronSecret);toast.success('Секрет скопирован');}} variant="outline" size="sm"><Copy className="h-3.5 w-3.5 mr-1.5"/>Копировать</Button>}{cronSecret&&<Button onClick={testCronNow} disabled={cronTesting} variant="outline" size="sm"><Zap className="h-3.5 w-3.5 mr-1.5"/>Проверить</Button>}</div>{cronSecret&&<Input readOnly value={cronSecret} className="font-mono text-xs mt-3"/>}</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader><CardTitle className="text-base flex items-center gap-2">🔗 МТС Линк</CardTitle><CardDescription><b>Только чтение.</b> WebinarFlow собирает доступную информацию из МТС Линк, но не создаёт и не изменяет вебинары, записи или другие объекты в МТС Линк.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>API ключ</Label><Input type="password" value={mtsApiKey} onChange={(e) => setMtsApiKey(e.target.value)} placeholder={mtsConfigured ? 'Оставьте пустым, чтобы сохранить текущий ключ' : 'Вставьте API ключ из МТС Линк'} className="mt-1 font-mono text-sm" /><p className="text-xs text-muted-foreground mt-1">Личный кабинет МТС Линк → Бизнес → API/Webhooks.</p></div>
            <div><Label>Base URL</Label><Input value={mtsBaseUrl} onChange={(e) => setMtsBaseUrl(e.target.value)} placeholder="https://webinar.mts-link.ru/api/v1" className="mt-1 font-mono text-sm" /></div>
            <div className="flex items-center gap-3"><Button onClick={async () => { setMtsStatus('idle'); try { const res = await fetch('/api/mts-link'); const data = await res.json(); if (!res.ok || !data.configured) throw new Error(data.error || 'API ключ не задан'); setMtsStatus('ok'); toast.success(`Подключено: ${data.baseUrl}`); } catch (error) { setMtsStatus('error'); toast.error(error instanceof Error ? error.message : 'Ошибка проверки'); } }} variant="outline" size="sm">Проверить подключение</Button>{mtsStatus === 'ok' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}{mtsStatus === 'error' && <AlertCircle className="h-4 w-4 text-red-500" />}</div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader><CardTitle className="text-base">Периоды создания задач</CardTitle><CardDescription>За сколько рабочих дней до вебинара создавать задачи.</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(['unisender', 'mtsLink', 'reminder', 'eventDay', 'sms'] as const).map((key) => <div key={key}><Label>{s.taskTypeNames[key] || key}</Label><Input type="number" min={0} value={s.taskPeriods[key]} onChange={(e) => updatePeriod(key, e.target.value)} className="mt-1" /></div>)}</CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader><CardTitle className="text-base">Названия типов задач</CardTitle><CardDescription>Кастомизация отображаемых названий без изменения исторических данных.</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">{(Object.keys(s.taskTypeNames) as (keyof AppSettings['taskTypeNames'])[]).map((key) => <div key={key}><Label>{key}</Label><Input value={s.taskTypeNames[key]} onChange={(e) => updateTypeName(key, e.target.value)} className="mt-1" /></div>)}</CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-white">
          <CardHeader><CardTitle className="text-base">Параметры переноса</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label className="mb-2 block">Направление переноса задач при изменении даты вебинара</Label><RadioGroup value={s.taskShiftDirection} onValueChange={(v) => setS((p) => ({ ...p, taskShiftDirection: v }))} className="flex gap-4"><div className="flex items-center gap-2"><RadioGroupItem value="back" id="shift-back" /><Label htmlFor="shift-back">Назад</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="forward" id="shift-forward" /><Label htmlFor="shift-forward">Вперёд</Label></div></RadioGroup></div>
            <div><Label>Максимальный сдвиг (дней)</Label><Input type="number" min={1} value={s.maxShiftDays} onChange={(e) => setS((p) => ({ ...p, maxShiftDays: e.target.value }))} className="mt-1 w-32" /></div>
            <div className="flex items-center gap-3"><Switch checked={s.autoRecalc === 'true'} onCheckedChange={(v) => setS((p) => ({ ...p, autoRecalc: String(v) }))} /><Label>Автоматический пересчёт задач при изменении даты вебинара</Label></div>
          </CardContent>
        </Card>

        <div className="flex justify-end pb-3"><Button onClick={handleSave} disabled={saving} className="bg-[#1E5BEB] hover:bg-[#1749bb] px-5"><Save className="h-4 w-4 mr-2" />{saving ? 'Сохранение...' : 'Сохранить настройки'}</Button></div>
      </div>
    </div>
  );
}
