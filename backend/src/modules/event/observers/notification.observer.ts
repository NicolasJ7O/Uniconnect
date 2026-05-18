import { prisma } from '../../../lib/prisma.js';
import { emitToUser } from '../../../lib/socket.js';
import type { EventObserver, EventEvent } from './event.subject.js';

export class EventNotificationObserver implements EventObserver {
  async update(event: EventEvent, data: any): Promise<void> {
    if (event === 'EVENT_CREATED') {
      await this.handleEventCreated(data);
    }
  }

  private async handleEventCreated(data: {
    eventId: string;
    title: string;
    category: string;
    organizerName: string;
  }) {
    const { eventId, title, category, organizerName } = data;

    // Find all users subscribed to this category
    const subscriptions = await prisma.eventSubscription.findMany({
      where: { category },
      select: { userId: true },
    });

    if (subscriptions.length === 0) return;

    const message = `Nuevo evento "${title}" en la categoría ${category} publicado por ${organizerName}`;
    const metadata = { eventId, category, eventTitle: title };

    // Create a notification for each subscriber and emit via WebSocket
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
