import type { StudySessionRecurrenceInput } from './study-session.schemas.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function setTimeFromSource(target: Date, source: Date) {
  const result = new Date(target);
  result.setHours(
    source.getHours(),
    source.getMinutes(),
    source.getSeconds(),
    source.getMilliseconds()
  );
  return result;
}

function normalizeDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function monthDiff(base: Date, candidate: Date) {
  return (candidate.getFullYear() - base.getFullYear()) * 12 + (candidate.getMonth() - base.getMonth());
}

export function buildRecurrenceOccurrences(
  baseStartAt: Date,
  recurrence: StudySessionRecurrenceInput
): Date[] {
  const endDate = new Date(recurrence.endDate);
  if (endDate.getTime() < baseStartAt.getTime()) {
    return [];
  }

  const occurrences = [new Date(baseStartAt)];
  const baseDate = normalizeDateOnly(baseStartAt);
  const targetDay = recurrence.dayOfMonth ?? baseStartAt.getDate();
  const weekdays = recurrence.daysOfWeek?.length ? new Set(recurrence.daysOfWeek) : new Set([baseStartAt.getDay()]);

  for (
    let cursor = addDays(baseDate, 1);
    cursor.getTime() <= endDate.getTime();
    cursor = addDays(cursor, 1)
  ) {
    const aligned = setTimeFromSource(cursor, baseStartAt);

    if (aligned.getTime() > endDate.getTime()) {
      break;
    }

    switch (recurrence.frequency) {
      case 'DAILY': {
        const diffDays = Math.floor((cursor.getTime() - baseDate.getTime()) / DAY_IN_MS);
        if (diffDays % recurrence.interval === 0) {
          occurrences.push(aligned);
        }
        break;
      }
      case 'INTERVAL': {
        const diffDays = Math.floor((cursor.getTime() - baseDate.getTime()) / DAY_IN_MS);
        if (diffDays % recurrence.interval === 0) {
          occurrences.push(aligned);
        }
        break;
      }
      case 'WEEKLY': {
        const weeksSinceStart = Math.floor((cursor.getTime() - baseDate.getTime()) / (7 * DAY_IN_MS));
        if (weeksSinceStart % recurrence.interval === 0 && weekdays.has(cursor.getDay())) {
          occurrences.push(aligned);
        }
        break;
      }
      case 'MONTHLY': {
        const diffMonths = monthDiff(baseStartAt, cursor);
        if (diffMonths % recurrence.interval === 0 && cursor.getDate() === targetDay) {
          const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), targetDay);
          if (isSameDay(candidate, cursor)) {
            occurrences.push(aligned);
          }
        }
        break;
      }
    }
  }

  const deduped = new Map<string, Date>();
  for (const occurrence of occurrences) {
    deduped.set(occurrence.toISOString(), occurrence);
  }

  return Array.from(deduped.values()).sort((a, b) => a.getTime() - b.getTime());
}

export function buildReminderSchedule(startAt: Date, minutesBeforeList: number[]) {
  return minutesBeforeList.map((minutesBefore) => ({
    minutesBefore,
    scheduledAt: new Date(startAt.getTime() - minutesBefore * 60 * 1000),
  })).filter((reminder) => reminder.scheduledAt.getTime() > 0);
}
