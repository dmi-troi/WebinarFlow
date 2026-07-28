import { db } from '@/lib/db';

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.settings.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function sendTelegram(
  chatId: string,
  text: string,
  options?: { parse_mode?: string; reply_markup?: object }
): Promise<{ ok: boolean; error?: string }> {
  const settings = await getSettings();
  const token = settings.telegramBotToken;
  if (!token) return { ok: false, error: 'Bot token not configured' };

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
    };
    if (options?.reply_markup) body.reply_markup = options.reply_markup;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function setWebhook(webhookUrl: string): Promise<{ ok: boolean; error?: string; description?: string }> {
  const settings = await getSettings();
  const token = settings.telegramBotToken;
  if (!token) return { ok: false, error: 'Bot token not configured' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description };
    return { ok: true, description: data.description };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}

export async function deleteWebhook(): Promise<boolean> {
  const settings = await getSettings();
  const token = settings.telegramBotToken;
  if (!token) return false;
  try { await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: 'POST' }); return true; } catch { return false; }
}

export function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
