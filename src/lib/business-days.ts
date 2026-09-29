import { formatInTimeZone } from 'date-fns-tz';

export const MSK_TIME_ZONE = 'Europe/Moscow';

type HolidayLike = { date: Date | string };

function dateKey(value: Date | string) {
  return formatInTimeZone(value, MSK_TIME_ZONE, 'yyyy-MM-dd');
}

export function isBusinessDay(date: Date, holidays: HolidayLike[]) {
  const day = Number(formatInTimeZone(date, MSK_TIME_ZONE, 'i'));
  if (day >= 6) return false;
  const key = dateKey(date);
  return !holidays.some((holiday) => dateKey(holiday.date) === key);
}

export function shiftToBusinessDay(
  input: Date,
  holidays: HolidayLike[],
  direction: 'back' | 'forward' = 'back',
  maxShiftDays = 7,
) {
  const date = new Date(input);
  if (isBusinessDay(date, holidays)) return date;

  const step = direction === 'forward' ? 1 : -1;
  for (let i = 0; i < Math.max(1, maxShiftDays); i += 1) {
    date.setUTCDate(date.getUTCDate() + step);
    if (isBusinessDay(date, holidays)) return date;
  }
  return input;
}
