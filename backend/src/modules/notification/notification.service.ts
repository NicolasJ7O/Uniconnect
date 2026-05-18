import { prisma } from '../../lib/prisma.js';

export async function getUserNotifications(userId: string) {
    return prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50 // Limit to recent 50 for now
    });
}

export async function markAsRead(notificationId: string, userId: string) {
    return prisma.notification.update({
        where: { id: notificationId, userId },
        data: { isRead: true }
    });
}

export async function markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true }
    });
}

export async function deleteNotification(notificationId: string, userId: string) {
    return prisma.notification.delete({
        where: { id: notificationId, userId }
    });
}