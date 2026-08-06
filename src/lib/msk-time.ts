import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { ru } from 'date-fns/locale';

export const MSK_TZ = 'Europe/Moscow';

// Все пользователи и вебинары — по московскому времени. Раньше даты
// парсились/форматировались через неявную локальную таймзону (то сервера,
// то браузера), из-за чего 12:00 могло превращаться в 15:00 при показе.
// Эти хелперы делают московское время явным на обоих концах.

// <input type="date"> + <input type="time"> (МСК) -> реальный момент времени (UTC internally)
export function mskInputToDate(dateStr: string, timeStr: string): Date {
  return fromZonedTime(`${dateStr}T${timeStr}:00`, MSK_TZ);
}

// Любая дата/ISO-строка -> отформатированная строка по МСК (форматы как в date-fns)
export function formatMsk(date: Date | string, fmt: string): string {
  return formatInTimeZone(date, MSK_TZ, fmt, { locale: ru });
}

// Значение для <input type="date"> (МСК)
export function mskDateInputValue(date: Date | string): string {
  return formatInTimeZone(date, MSK_TZ, 'yyyy-MM-dd');
}

// Значение для <input type="time"> (МСК)
export function mskTimeInputValue(date: Date | string): string {
  return formatInTimeZone(date, MSK_TZ, 'HH:mm');
}
