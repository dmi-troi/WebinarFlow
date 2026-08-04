import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/**
 * GET /api/notifications/cron
 * Вызывается cron-job.org каждые 5 минут.
 * Проверяет задачи со статусом 'pending', у которых время напоминания
 * (reminderTime) попадает в окно ±20 минут от текущего момента.
 * Отправляет уведомление в Telegram и записывает факт отправки в Settings,
 * чтобы не дублировать.
 */
export async function GET(request: Request) {
  const now = new Date();

  // Пропускаем авторизацию для cron-job.org
  const ua = request.headers.get('user-agent') || '';
  // (раньше проверялся CRON_SECRET — убрано, т.к. cron-job.org не передаёт заголовки)

  // 1. Читаем лог отправленных уведомлений из Settings
  let notifLog = await db.settings.findUnique({ where: { key: 'notificationLog' } });
  const notified: Record<string, number> = notifLog ? JSON.parse(notifLog.value) : {};

  // Очищаем записи старше 48 часов
  const cutoff = now.getTime() - 48 * 60 * 60 * 1000;
  for (const [id, ts] of Object.entries(notified)) {
    if (ts < cutoff) delete notified[id];
  }

  // 2. Получаем настройки Telegram
  const settings = await db.settings.findMany();
  const sm: Record<string, string> = {};
  for (const s of settings) sm[s.key] = s.value;

  const botToken = sm.telegramBotToken;
  const chatId = sm.telegramChatId;

  if (!botToken || !chatId) {
    return NextResponse.json({ error: 'Telegram не настроен', checked: 0 });
  }

  // 3. Получаем все pending задачи
  const tasks = await db.task.findMany({
    where: { status: 'pending' },
    include: { webinar: true, responsible: true },
    orderBy: { dueDate: 'asc' },
  });

  const WINDOW_MS = 20 * 60 * 1000; // 20 минут
  let sentCount = 0;
  const errors: string[] = [];

  for (const task of tasks) {
    // Пропускаем уже отправленные
    if (notified[task.id]) continue;

    // 4. Вычисляем datetime напоминания
    const dueDate = new Date(task.dueDate);

    let reminderDateTime: Date;

    if (task.reminderTime) {
      // Берём ДАТУ из dueDate (в часовом поясе Москвы) и склеиваем с reminderTime
      const datePart = dueDate.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
      reminderDateTime = new Date(`${datePart}T${task.reminderTime}:00+03:00`);
    } else {
      // Fallback: за 30 минут до dueDate
      reminderDateTime = new Date(dueDate.getTime() - 30 * 60 * 1000);
    }

    // Проверяем валидность даты
    if (isNaN(reminderDateTime.getTime())) continue;

    // 5. Проверяем окно: reminderDateTime должен быть в пределах [-5 мин, +20 мин] от now
    // (небольшой запас назад на случай задержки cron)
    const diffMs = now.getTime() - reminderDateTime.getTime();
    if (diffMs < -5 * 60 * 1000 || diffMs > WINDOW_MS) continue;

    // 6. Формируем сообщение
    const responsibleName = task.responsible?.name || '';
    const webinarTitle = task.webinar?.title || '';
    const dueStr = dueDate.toLocaleString('ru-RU', {
      timeZone: 'Europe/Moscow',
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });

    let text = `\u{1F514} <b>Напоминание по задаче</b>\n\n`;
    text += `\u{1F4CB} ${task.title}\n`;
    if (webinarTitle) text += `\u{1F3AC} Вебинар: ${webinarTitle}\n`;
    text += `\u{1F4C5} Срок: ${dueStr}\n`;
    if (task.reminderTime) text += `\u{23F0} Напоминание: ${task.reminderTime}\n`;
    if (responsibleName) text += `\u{1F464} ${responsibleName}\n`;

    // 7. Отправляем в Telegram
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
      const data = await res.json();
      if (data.ok) {
        notified[task.id] = now.getTime();
        sentCount++;
      } else {
        errors.push(`${task.id.slice(0, 8)}: ${data.description}`);
      }
    } catch (e: any) {
      errors.push(`${task.id.slice(0, 8)}: ${e.message}`);
    }
  }

  // 8. Сохраняем обновлённый лог
  await db.settings.upsert({
    where: { key: 'notificationLog' },
    update: { value: JSON.stringify(notified) },
    create: { key: 'notificationLog', value: JSON.stringify(notified) },
  });

  return NextResponse.json({
    checked: tasks.length,
    sent: sentCount,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: now.toISOString(),
  });
}
