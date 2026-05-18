import { z } from 'zod';

export const EVENT_CATEGORIES = ['ACADEMICO', 'CULTURAL', 'DEPORTIVO', 'TECNOLOGIA', 'OTRO'] as const;
export type EventCategory = typeof EVENT_CATEGORIES[number];

export const createEventSchema = z.object({
    title: z.string().min(3).max(200),
    description: z.string().min(5).max(1000),
    eventDate: z.string().datetime(),
    location: z.string().max(300).optional(),
    category: z.enum(EVENT_CATEGORIES).default('OTRO'),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const subscribeCategorySchema = z.object({
    category: z.enum(EVENT_CATEGORIES),
});
