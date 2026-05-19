import { prisma } from '../../../lib/prisma.js';
import { emitToUser } from '../../../lib/socket.js';
import type { IObserver, EventoUniversidadEvent } from './event.subject.js';

export class EventoNotificationObserver implements IObserver {
  async update(event: EventoUniversidadEvent, data: any): Promise<void> {
    if (event === 'NUEVO_EVENTO') {
      await this.handleNuevoEvento(data);
    }
  }

  private async handleNuevoEvento(data: {
    eventId: string;
    title: string;
    category: string;
    organizerName: string;
  }) {
    const { eventId, title, category, organizerName } = data;

    // Normalizar la categoría a mayúsculas
    const normalizedCategory = category.toUpperCase();

    // Encontrar todos los usuarios suscritos a esta categoría específica
    const subscriptions = await prisma.eventSubscription.findMany({
      where: { category: normalizedCategory },
      select: { userId: true },
    });

    if (subscriptions.length === 0) return;

    const message = `Nuevo evento "${title}" en la categoría ${normalizedCategory} publicado por ${organizerName}`;
    const metadata = { eventId, category: normalizedCategory, eventTitle: title };

    // Crear una notificación y emitir vía WebSocket para cada suscriptor
    for (const sub of subscriptions) {
      const notif = await prisma.notification.create({
        data: {
          userId: sub.userId,
          type: 'NEW_EVENT',
          message,
          metadata,
        },
      });
      emitToUser(sub.userId, 'new-notification', { ...notif, ...metadata });
    }
  }
}
