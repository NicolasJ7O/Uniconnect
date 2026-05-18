import { Router } from 'express';
import {
    getEventsHandler,
    getEventByIdHandler,
    createEventHandler,
    deleteEventHandler,
    subscribeHandler,
    unsubscribeHandler,
    getMySubscriptionsHandler,
} from './event.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const eventRouter = Router();

eventRouter.use(requireAuth);

eventRouter.get('/', getEventsHandler);
eventRouter.post('/', createEventHandler);
eventRouter.get('/subscriptions', getMySubscriptionsHandler);
eventRouter.post('/subscribe', subscribeHandler);
eventRouter.delete('/subscribe/:category', unsubscribeHandler);
eventRouter.get('/:id', getEventByIdHandler);
eventRouter.delete('/:id', deleteEventHandler);
