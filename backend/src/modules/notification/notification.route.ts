import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import * as notificationController from './notification.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', notificationController.getNotificationsHandler);
router.put('/mark-all-read', notificationController.markAllAsReadHandler);
router.put('/:id/read', notificationController.markAsReadHandler);
router.delete('/:id', notificationController.deleteNotificationHandler);

export default router;