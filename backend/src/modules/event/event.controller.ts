import type { Request, Response } from 'express';
import { catchAsync } from '../../lib/catch-async.js';
import * as eventService from './event.service.js';
import { createEventSchema, subscribeCategorySchema } from './event.schemas.js';

export const getEventsHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user?.sub;
    const categoriesFromQuery = typeof req.query.categories === 'string'
        ? [req.query.categories]
        : Array.isArray(req.query.categories)
            ? req.query.categories.filter((value): value is string => typeof value === 'string')
            : undefined;

    const categories = categoriesFromQuery?.length
        ? categoriesFromQuery
        : typeof req.query.category === 'string'
            ? [req.query.category]
            : Array.isArray(req.query.category)
                ? req.query.category.filter((value): value is string => typeof value === 'string')
                : undefined;

    const events = await eventService.getAllEvents({
        categories,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        fromDate: typeof req.query.fromDate === 'string' ? req.query.fromDate : undefined,
        toDate: typeof req.query.toDate === 'string' ? req.query.toDate : undefined,
        availability: typeof req.query.availability === 'string' ? req.query.availability as 'available' | 'full' : undefined,
        limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
        offset: typeof req.query.offset === 'string' ? Number(req.query.offset) : undefined,
        userId,
    });
    res.json(events);
});

export const getEventByIdHandler = catchAsync(async (req: Request, res: Response) => {
    const event = await eventService.getEventById(req.params.id, req.user?.sub);
    res.json(event);
});

export const createEventHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const parsed = createEventSchema.parse(req.body);
    const event = await eventService.createEvent(userId, parsed);
    res.status(201).json(event);
});

export const toggleAttendanceHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;

    if (req.method === 'DELETE') {
        const result = await eventService.cancelAttendance(req.params.id, userId);
        res.json(result);
        return;
    }

    const result = await eventService.registerAttendance(req.params.id, userId);
    res.json(result);
});

export const generateQrHandler = catchAsync(async (req: Request, res: Response) => {
    const result = await eventService.generateQrPass(req.params.id, req.user!.sub);
    res.json(result);
});

export const verifyQrHandler = catchAsync(async (req: Request, res: Response) => {
    const result = await eventService.verifyQrPass(String(req.body?.token || ''));
    res.json(result);
});

export const deleteEventHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    await eventService.deleteEvent(req.params.id, userId);
    res.json({ message: 'Evento eliminado correctamente' });
});

export const subscribeHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const { category } = subscribeCategorySchema.parse(req.body);
    const sub = await eventService.subscribeToCategory(userId, category);
    res.status(201).json(sub);
});

export const unsubscribeHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    let category = req.params.category;
    if (!category && req.body && req.body.category) {
        const parsed = subscribeCategorySchema.parse(req.body);
        category = parsed.category;
    }
    if (!category) {
        res.status(400).json({ error: 'La categoría es requerida' });
        return;
    }
    await eventService.unsubscribeFromCategory(userId, category);
    res.json({ message: 'Suscripción cancelada' });
});

export const getMySubscriptionsHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const subscriptions = await eventService.getUserSubscriptions(userId);
    res.json(subscriptions);
});
