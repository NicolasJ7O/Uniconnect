import { prisma } from '../../lib/prisma.js';
import {
  NotificacionBase,
  NotificacionConPrioridad,
  NotificacionConAccion,
  type PrioridadNivel,
  type ISystemNotification
} from './decorators/notification.decorator.js';

export function decorateNotification(dbNotif: any) {
  let notification: ISystemNotification = new NotificacionBase(
    dbNotif.message,
    dbNotif.userId,
    dbNotif.createdAt
  );

  let nivel: PrioridadNivel = 'normal';
  if (dbNotif.metadata && typeof dbNotif.metadata === 'object') {
    const meta = dbNotif.metadata as Record<string, any>;
    if (meta.nivel) {
      nivel = meta.nivel as PrioridadNivel;
    } else if (dbNotif.type === 'TRANSFER_REQUESTED') {
      nivel = 'urgente';
    } else if (dbNotif.type === 'JOIN_REQUESTED') {
      nivel = 'urgente';
    }
  }
  notification = new NotificacionConPrioridad(notification, nivel);

  if (dbNotif.metadata && typeof dbNotif.metadata === 'object') {
    const meta = dbNotif.metadata as Record<string, any>;
    if (meta.accion) {
      notification = new NotificacionConAccion(notification, meta.accion);
    } else if (dbNotif.type === 'JOIN_REQUESTED') {
      notification = new NotificacionConAccion(notification, {
        label: 'Ver Solicitud',
        endpoint: `/groups/requests/${dbNotif.id}`
      });
    }
  }

  return {
    ...dbNotif,
    ...notification.toJSON(),
  };
}

export async function getUserNotifications(userId: string) {
    const dbNotifs = await prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50 // Limit to recent 50 for now
    });
    return dbNotifs.map(decorateNotification);
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