import { Request, Response } from 'express';
import { catchAsync } from '../../lib/catch-async.js';
import * as notificationService from './notification.service.js';

export const getNotificationsHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const notifications = await notificationService.getUserNotifications(userId);
    res.json(notifications);
});

export const markAsReadHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id, userId);
    res.json(notification);
});

export const markAllAsReadHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    await notificationService.markAllAsRead(userId);
    res.json({ message: 'All notifications marked as read' });
});

export const deleteNotificationHandler = catchAsync(async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const { id } = req.params;
    await notificationService.deleteNotification(id, userId);
    res.json({ message: 'Notification deleted successfully' });
});