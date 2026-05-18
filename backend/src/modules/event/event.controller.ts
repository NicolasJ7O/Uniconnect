import type { Request, Response } from 'express';
import { catchAsync } from '../../lib/catch-async.js';
import * as eventService from './event.service.js';
import { createEventSchema, subscribeCategorySchema } from './event.schemas.js';

export const getEventsHandler = catchAsync(async (req: Request, res: Response) => {
    const category = req.query.category as string | undefined;
    const events = await eventService.getAllEvents(category);
    res.json(events);
});

export const getEventByIdHandler = catchAsync(async (req: Request, res: Response) => {
    const event = await eventService.getEventById(req.params.id);
    res.json(event);
});

export const createEventHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const parsed = createEventSchema.parse(req.body);
    const event = await eventService.createEvent(userId, parsed);
    res.status(201).json(event);
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
    const category = req.params.category;
    await eventService.unsubscribeFromCategory(userId, category);
    res.json({ message: 'Suscripción cancelada' });
});

export const getMySubscriptionsHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const subscriptions = await eventService.getUserSubscriptions(userId);
    res.json(subscriptions);
});
