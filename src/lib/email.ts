// Отправка email через Resend (https://resend.com).
// RESEND_API_KEY задаётся переменной окружения (уже настроена на Render).
// RESEND_FROM_EMAIL опционален — по умолчанию используется тестовый
// адрес Resend, который работает без верификации собственного домена,
// но виден получателю как "onboarding@resend.dev". Чтобы письма
// приходили с вашего домена — добавьте переменную RESEND_FROM_EMAIL
// после верификации домена в кабинете Resend.
const DEFAULT_FROM = 'WebinarFlow <onboarding@resend.dev>';

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY не задан' };
  if (!to) return { ok: false, error: 'Не указан email получателя' };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[email] Resend error ${res.status}:`, text.slice(0, 500));
      return { ok: false, error: `Resend вернул ${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    console.error('[email] send failed:', e.message);
    return { ok: false, error: e.message };
  }
}
