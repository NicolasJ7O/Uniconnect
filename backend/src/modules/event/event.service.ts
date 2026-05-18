import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { eventSubject } from './observers/index.js';
import type { CreateEventInput } from './event.schemas.js';
import { getIO } from '../../lib/socket.js';

export async function getAllEvents(category?: string) {
    return prisma.event.findMany({
        where: category && category !== 'TODOS' ? { category } : undefined,
        include: {
            organizer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { eventDate: 'asc' },
    });
}

export async function getEventById(eventId: string) {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: { organizer: { select: { id: true, name: true, email: true } } },
    });
    if (!event) throw new AppError(404, 'Evento no encontrado');
    return event;
}

export async function createEvent(organizerId: string, data: CreateEventInput) {
    const organizer = await prisma.user.findUnique({
        where: { id: organizerId },
        select: { name: true, email: true },
    });

    const event = await prisma.event.create({
        data: {
            title: data.title,
            description: data.description,
            eventDate: new Date(data.eventDate),
            location: data.location,
            category: data.category,
            organizerId,
        },
        include: { organizer: { select: { id: true, name: true, email: true } } },
    });

    // Notify subscribers via Observer pattern
    await eventSubject.notify('EVENT_CREATED', {
        eventId: event.id,
        title: event.title,
        category: event.category,
        organizerName: organizer?.name || organizer?.email || 'Un estudiante',
    });

    // Broadcast the new event globally to all connected clients
    try {
        getIO().emit('new-event', event);
    } catch (e) {
        console.error('Error broadcasting new-event:', e);
    }

    return event;
}

export async function deleteEvent(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError(404, 'Evento no encontrado');
    if (event.organizerId !== userId) throw new AppError(403, 'Solo el organizador puede eliminar este evento');
    
    const deletedEvent = await prisma.event.delete({ where: { id: eventId } });

    // Broadcast deleted event ID globally to all connected clients
    try {
        getIO().emit('delete-event', { id: eventId });
    } catch (e) {
        console.error('Error broadcasting delete-event:', e);
    }

    return deletedEvent;
}

export async function subscribeToCategory(userId: string, category: string) {
    return prisma.eventSubscription.upsert({
        where: { userId_category: { userId, category } },
        update: {},
        create: { userId, category },
    });
}

export async function unsubscribeFromCategory(userId: string, category: string) {
    try {
        return await prisma.eventSubscription.delete({
            where: { userId_category: { userId, category } },
        });
    } catch {
        throw new AppError(404, 'No estás suscrito a esta categoría');
    }
}

export async function getUserSubscriptions(userId: string) {
    const subs = await prisma.eventSubscription.findMany({
        where: { userId },
        select: { category: true, createdAt: true },
    });
    return subs.map(s => s.category);
}
