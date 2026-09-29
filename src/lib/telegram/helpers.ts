import { db } from '@/lib/db';

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.settings.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function sendTelegram(chatId: string, text: string, options?: { parse_mode?: string; reply_markup?: object }) {
  const settings = await getSettings();
  const token = settings.telegramBotToken;
  if (!token) return { ok: false, error: 'Bot token not configured' };
  try {
    const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: options?.parse_mode || 'HTML' };
    if (options?.reply_markup) body.reply_markup = options.reply_markup;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function getOrCreateWebhookSecret() {
  const existing = await db.settings.findUnique({ where: { key: 'telegramWebhookSecret' } });
  if (existing?.value) return existing.value;
  const { randomBytes } = await import('node:crypto');
  const secret = randomBytes(32).toString('hex');
  await db.settings.upsert({ where: { key: 'telegramWebhookSecret' }, update: { value: secret }, create: { key: 'telegramWebhookSecret', value: secret } });
  return secret;
}

export async function setWebhook(webhookUrl: string) {
  const settings = await getSettings();
  const token = settings.telegramBotToken;
  if (!token) return { ok: false, error: 'Bot token not configured' };
  const secret = settings.telegramWebhookSecret || await getOrCreateWebhookSecret();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret, allowed_updates: ['message'] }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.description };
    return { ok: true, description: data.description };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteWebhook() {
  const settings = await getSettings();
  if (!settings.telegramBotToken) return false;
  try { await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/deleteWebhook`, { method: 'POST' }); return true; } catch { return false; }
}

export function fmtDate(d: Date | string) { return new Date(d).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric' }); }
export function fmtDateTime(d: Date | string) { return new Date(d).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
