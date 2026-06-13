import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRecurrenceOccurrences, buildReminderSchedule } from './recurrence.service.js';

test('buildRecurrenceOccurrences generates daily series within range', () => {
  const baseStartAt = new Date('2026-06-10T08:00:00.000Z');
  const occurrences = buildRecurrenceOccurrences(baseStartAt, {
    frequency: 'DAILY',
    interval: 2,
    endDate: '2026-06-16T23:59:59.000Z',
  });

  assert.equal(occurrences.length, 4);
  assert.equal(occurrences[0].toISOString(), '2026-06-10T08:00:00.000Z');
  assert.equal(occurrences[1].toISOString(), '2026-06-12T08:00:00.000Z');
  assert.equal(occurrences[2].toISOString(), '2026-06-14T08:00:00.000Z');
  assert.equal(occurrences[3].toISOString(), '2026-06-16T08:00:00.000Z');
});

test('buildRecurrenceOccurrences respects weekly weekdays', () => {
  const baseStartAt = new Date('2026-06-08T09:30:00.000Z');
  const occurrences = buildRecurrenceOccurrences(baseStartAt, {
    frequency: 'WEEKLY',
    interval: 1,
    endDate: '2026-06-15T23:59:59.000Z',
    daysOfWeek: [1, 3],
  });

  assert.equal(occurrences.length, 3);
  assert.equal(occurrences[0].toISOString(), '2026-06-08T09:30:00.000Z');
  assert.equal(occurrences[1].toISOString(), '2026-06-10T09:30:00.000Z');
  assert.equal(occurrences[2].toISOString(), '2026-06-15T09:30:00.000Z');
});

test('buildReminderSchedule filters reminders that have already elapsed', () => {
  const startAt = new Date('2026-06-10T10:00:00.000Z');
  const reminders = buildReminderSchedule(startAt, [5, 15, 60]);

  assert.equal(reminders.length, 3);
  assert.equal(reminders[0].minutesBefore, 5);
  assert.equal(reminders[2].scheduledAt.toISOString(), '2026-06-10T09:00:00.000Z');
});

