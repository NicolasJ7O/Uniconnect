import { z } from 'zod';

export const SESSION_RECURRENCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'INTERVAL'] as const;
export const SESSION_STATUSES = ['SCHEDULED', 'CANCELED', 'COMPLETED'] as const;

const reminderSchema = z.object({
  minutesBefore: z.coerce.number().int().min(1).max(10080),
});

const recurrenceSchema = z.object({
  frequency: z.preprocess(
    (value) => (typeof value === 'string' ? value.toUpperCase() : value),
    z.enum(SESSION_RECURRENCE_FREQUENCIES)
  ),
  interval: z.coerce.number().int().min(1).default(1),
  endDate: z.string().datetime(),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
});

export const createStudySessionSchema = z.object({
  title: z.string().min(3).max(180),
  description: z.string().max(1000).optional(),
  subjectId: z.string().min(1),
  startAt: z.string().datetime(),
  durationMinutes: z.coerce.number().int().min(15).max(1440),
  participantIds: z.array(z.string().min(1)).default([]),
  reminders: z.array(reminderSchema).min(1).max(4).default([{ minutesBefore: 15 }]),
  recurrence: recurrenceSchema.optional(),
});

export const updateStudySessionSeriesSchema = z.object({
  title: z.string().min(3).max(180).optional(),
  description: z.string().max(1000).optional(),
  subjectId: z.string().min(1).optional(),
  startAt: z.string().datetime().optional(),
  durationMinutes: z.coerce.number().int().min(15).max(1440).optional(),
  participantIds: z.array(z.string().min(1)).optional(),
  reminders: z.array(reminderSchema).min(1).max(4).optional(),
  recurrence: recurrenceSchema.optional(),
  effectiveFrom: z.string().datetime().optional(),
});

export const updateStudySessionSchema = z.object({
  title: z.string().min(3).max(180).optional(),
  description: z.string().max(1000).optional(),
  startAt: z.string().datetime().optional(),
  durationMinutes: z.coerce.number().int().min(15).max(1440).optional(),
  participantIds: z.array(z.string().min(1)).optional(),
  reminders: z.array(reminderSchema).min(1).max(4).optional(),
});

export const cancelStudySessionSchema = z.object({
  reason: z.string().max(300).optional(),
});

export type CreateStudySessionInput = z.infer<typeof createStudySessionSchema>;
export type UpdateStudySessionSeriesInput = z.infer<typeof updateStudySessionSeriesSchema>;
export type UpdateStudySessionInput = z.infer<typeof updateStudySessionSchema>;
export type CancelStudySessionInput = z.infer<typeof cancelStudySessionSchema>;
export type StudySessionRecurrenceInput = z.infer<typeof recurrenceSchema>;

