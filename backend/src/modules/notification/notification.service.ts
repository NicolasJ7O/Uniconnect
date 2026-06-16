import { prisma } from '../../lib/prisma.js';
import { emitToUser } from '../../lib/socket.js';
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

export async function createSystemNotification(input: {
  userId: string;
  type: string;
  message: string;
  metadata?: Record<string, any>;
}) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      message: input.message,
      metadata: input.metadata ?? {},
    },
  });

  const decorated = decorateNotification(notification);
  // Emit the decorated notification but also flatten metadata onto the
  // payload so consumers can route easily (legacy observers used to emit
  // `{...notif, ...metadata}`).
  const payload = { ...decorated, ...(notification.metadata ?? {}) };
  emitToUser(input.userId, 'new-notification', payload);
  return decorated;
}
