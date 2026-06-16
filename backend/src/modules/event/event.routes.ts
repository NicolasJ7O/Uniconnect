import { Router } from 'express';
import {
    getEventsHandler,
    getEventByIdHandler,
    createEventHandler,
    toggleAttendanceHandler,
    generateQrHandler,
    verifyQrHandler,
    deleteEventHandler,
    subscribeHandler,
    unsubscribeHandler,
    getMySubscriptionsHandler,
} from './event.controller.js';
import {
    createEventInvitationHandler,
    listEventInvitationsHandler,
    acceptEventInvitationHandler,
    rejectEventInvitationHandler,
} from './event-invitation.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const eventRouter = Router();

eventRouter.use(requireAuth);

eventRouter.get('/', getEventsHandler);
eventRouter.post('/', createEventHandler);
eventRouter.get('/:id/qr', generateQrHandler);
eventRouter.post('/verify-qr', verifyQrHandler);
eventRouter.post('/:id/invitations', createEventInvitationHandler);
eventRouter.get('/:id/invitations', listEventInvitationsHandler);
eventRouter.post('/:id/attendance', toggleAttendanceHandler);
eventRouter.delete('/:id/attendance', toggleAttendanceHandler);
eventRouter.get('/subscriptions', getMySubscriptionsHandler);
eventRouter.post('/subscribe', subscribeHandler);
eventRouter.post('/suscribir', subscribeHandler);
eventRouter.delete('/subscribe/:category', unsubscribeHandler);
eventRouter.delete('/suscribir', unsubscribeHandler);
eventRouter.delete('/suscribir/:category', unsubscribeHandler);
eventRouter.post('/invitations/accept/:token', acceptEventInvitationHandler);
eventRouter.post('/invitations/reject/:token', rejectEventInvitationHandler);
eventRouter.get('/:id', getEventByIdHandler);
eventRouter.delete('/:id', deleteEventHandler);
