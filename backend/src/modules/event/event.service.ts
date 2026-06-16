import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { eventSubject } from './observers/index.js';
import type { CreateEventInput } from './event.schemas.js';
import { getIO } from '../../lib/socket.js';
import { env } from '../../config/env.js';

type EventListFilters = {
    categories?: string[];
    search?: string;
    fromDate?: string;
    toDate?: string;
    availability?: 'available' | 'full';
    limit?: number;
    offset?: number;
};

function normalizeCategories(categories?: string[]) {
    if (!categories || categories.length === 0) return undefined;
    return categories.filter(Boolean).map((category) => category.toUpperCase());
}

function buildEventWhere(input: EventListFilters) {
    const categories = normalizeCategories(input.categories);
    const search = input.search?.trim();

    const where: any = {
        eventDate: { gte: new Date() },
    };

    if (categories && categories.length > 0) {
        where.category = { in: categories };
    }

    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
        ];
    }

    if (input.fromDate) {
        where.eventDate = { ...where.eventDate, gte: new Date(input.fromDate) };
    }

    if (input.toDate) {
        where.eventDate = { ...where.eventDate, lte: new Date(input.toDate) };
    }

    if (input.availability === 'full') {
        where.capacity = { gt: 0 };
        where.attendances = { some: {} };
    }

    return where;
}

export async function getAllEvents(input: EventListFilters & { userId?: string }) {
    const limit = Math.max(1, Math.min(50, Number(input.limit ?? 10)));
    const offset = Math.max(0, Number(input.offset ?? 0));
    const where = buildEventWhere(input);

    // Hide private events from unauthenticated/public callers
    if (!input.userId) {
        where.isPrivate = false;
    }

    const items = await prisma.event.findMany({
        where,
        include: {
            organizer: { select: { id: true, name: true, email: true } },
            attendances: {
                where: { status: 'ACTIVE' },
                select: { user: { select: { id: true, name: true, email: true } } },
                orderBy: { createdAt: 'asc' },
            },
        },
        orderBy: { eventDate: 'asc' },
    });

    const events = items.map((event) => {
        const attendanceCount = event.attendances.filter((item) => item.user && item.user.id).length;
        const isFull = event.capacity > 0 && attendanceCount >= event.capacity;

        return {
            ...event,
            attendanceCount,
            isFull,
            isAttending: input.userId ? event.attendances.some((item) => item.user.id === input.userId) : false,
            attendees: event.attendances.map((item) => item.user),
        };
    });

    const filtered = input.availability
        ? events.filter((event) => (input.availability === 'full' ? event.isFull : !event.isFull))
        : events;

    const paged = filtered.slice(offset, offset + limit);

    return {
        items: paged,
        total: filtered.length,
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasMore: offset + limit < filtered.length,
    };
}

export async function getEventById(eventId: string, userId?: string) {
    const event = await prisma.event.findUnique({
        where: { id: eventId },
        include: {
            organizer: { select: { id: true, name: true, email: true } },
            attendances: {
                where: { status: 'ACTIVE' },
                select: {
                    user: { select: { id: true, name: true, email: true } },
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    if (!event) throw new AppError(404, 'Evento no encontrado');

    return {
        ...event,
        attendanceCount: event.attendances.length,
        isAttending: userId ? event.attendances.some((item) => item.user.id === userId) : false,
        attendees: event.attendances.map((item) => item.user),
    };
}

export async function createEvent(organizerId: string, data: CreateEventInput) {
    const organizer = await prisma.user.findUnique({
        where: { id: organizerId },
        select: { name: true, email: true },
    });

    if (data.categoryId) {
        const category = await prisma.eventCategory.findUnique({ where: { id: data.categoryId } });
        if (!category) throw new AppError(404, 'Categoría de evento no encontrada');
    }

    const event = await prisma.event.create({
        data: {
            title: data.title,
            description: data.description,
            eventDate: new Date(data.eventDate),
            location: data.location,
            isPrivate: data.isPrivate,
            category: data.category,
            categoryId: data.categoryId ?? null,
            organizerId,
        },
        include: { organizer: { select: { id: true, name: true, email: true } } },
    });

    // Notify subscribers via Observer pattern
    await eventSubject.notify('NUEVO_EVENTO', {
        eventId: event.id,
        title: event.title,
        category: event.category,
        organizerName: organizer?.name || organizer?.email || 'Un estudiante',
    });

    const formattedEvent = {
        ...event,
        attendanceCount: 0,
        isFull: false,
        isAttending: false,
        attendees: [],
    };

    // Broadcast the new event globally to all connected clients
    try {
        getIO().emit('new-event', formattedEvent);
    } catch (e) {
        console.error('Error broadcasting new-event:', e);
    }

    return event;
}

function buildAttendancePayload(eventId: string, updated: { user: { id: string; name: string | null; email: string; }; }[], isAttending: boolean) {
    return {
        eventId,
        attendanceCount: updated.length,
        isAttending,
        attendees: updated.map((item) => item.user),
    };
}

export async function registerAttendance(eventId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRawUnsafe('SELECT id FROM "Event" WHERE id = $1 FOR UPDATE', eventId);

        const event = await tx.event.findUnique({ where: { id: eventId } });
        if (!event) throw new AppError(404, 'Evento no encontrado');

        // If the event is private, only allow the organizer to register attendance via this endpoint.
        // Private event attendees must accept an invitation (consume invitation) which will create the attendance record.
        if (event.isPrivate && event.organizerId !== userId) {
            throw new AppError(403, 'Evento privado — la asistencia solo puede confirmarse mediante invitación');
        }

        const existing = await tx.eventAttendance.findUnique({
            where: { eventId_userId: { eventId, userId } },
        });

        if (existing?.status === 'ACTIVE') {
            throw new AppError(409, 'Ya se encuentra inscrito en este evento');
        }

        if (existing?.status === 'CANCELLED') {
            await tx.eventAttendance.update({
                where: { id: existing.id },
                data: { status: 'ACTIVE', checkedInAt: null, lastVerifiedAt: null, verificationCount: 0 },
            });
        }

        const attendanceCount = await tx.eventAttendance.count({ where: { eventId, status: 'ACTIVE' } });
        const hasCapacity = event.capacity <= 0 || attendanceCount < event.capacity;

        if (!hasCapacity) {
            throw new AppError(409, 'Cupo agotado');
        }

        const attendance = existing?.status === 'CANCELLED'
            ? await tx.eventAttendance.update({
                where: { id: existing.id },
                data: { status: 'ACTIVE', checkedInAt: null, lastVerifiedAt: null, verificationCount: 0 },
                include: { user: { select: { id: true, name: true, email: true } } },
            })
            : await tx.eventAttendance.create({
                data: { eventId, userId, status: 'ACTIVE' },
                include: { user: { select: { id: true, name: true, email: true } } },
            });

        const updated = await tx.eventAttendance.findMany({
            where: { eventId, status: 'ACTIVE' },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'asc' },
        });

        getIO().emit('attendance-updated', buildAttendancePayload(eventId, updated, true));
        console.info('[event-attendance] registered', { eventId, userId, attendanceCount: updated.length });

        return { eventId, attending: true, attendanceCount: updated.length, attendee: attendance.user };
    });
}

export async function cancelAttendance(eventId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
        await tx.$queryRawUnsafe('SELECT id FROM "Event" WHERE id = $1 FOR UPDATE', eventId);

        const event = await tx.event.findUnique({ where: { id: eventId } });
        if (!event) throw new AppError(404, 'Evento no encontrado');

        const existing = await tx.eventAttendance.findUnique({
            where: { eventId_userId: { eventId, userId } },
        });

        if (!existing) {
            throw new AppError(404, 'No se encontró tu inscripción en este evento');
        }

        if (existing.status === 'CANCELLED') {
            throw new AppError(409, 'Tu inscripción ya se encuentra cancelada');
        }

        const hoursRemaining = (new Date(event.eventDate).getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursRemaining < 24) {
            throw new AppError(409, 'No se puede cancelar con menos de 24 horas de anticipación. Contacta al organizador directamente.');
        }

        await tx.eventAttendance.update({
            where: { id: existing.id },
            data: { status: 'CANCELLED', checkedInAt: null },
        });

        const updated = await tx.eventAttendance.findMany({
            where: { eventId, status: 'ACTIVE' },
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'asc' },
        });

        getIO().emit('attendance-updated', buildAttendancePayload(eventId, updated, false));
        console.info('[event-attendance] cancelled', { eventId, userId, attendanceCount: updated.length });

        return { eventId, attending: false, attendanceCount: updated.length };
    });
}

function createSignedToken(payload: Record<string, unknown>) {
    const json = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', env.REFRESH_TOKEN_PEPPER).update(json).digest('hex');
    return Buffer.from(`${json}.${signature}`).toString('base64url');
}

function verifySignedToken(token: string) {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const separatorIndex = raw.lastIndexOf('.');
    if (separatorIndex <= 0) throw new AppError(400, 'Token QR inválido');

    const json = raw.slice(0, separatorIndex);
    const signature = raw.slice(separatorIndex + 1);
    const expected = crypto.createHmac('sha256', env.REFRESH_TOKEN_PEPPER).update(json).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) {
        throw new AppError(401, 'Firma QR inválida');
    }

    return JSON.parse(json) as { eventId: string; userId: string; timestamp: number; status: string };
}

export async function generateQrPass(eventId: string, userId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new AppError(404, 'Evento no encontrado');

    const attendance = await prisma.eventAttendance.findUnique({
        where: { eventId_userId: { eventId, userId } },
        include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!attendance || attendance.status !== 'ACTIVE') {
        throw new AppError(409, 'Tu inscripción no está activa para generar un pase QR');
    }

    const token = createSignedToken({ eventId, userId, timestamp: Date.now(), status: attendance.status });
    const qrPng = await QRCode.toDataURL(token, { width: 320, margin: 1 });

    return { eventId, userId, token, qrPng, attendee: attendance.user, eventDate: event.eventDate };
}

export async function verifyQrPass(token: string) {
    const payload = verifySignedToken(token);

    const event = await prisma.event.findUnique({ where: { id: payload.eventId } });
    if (!event) throw new AppError(404, 'Evento no encontrado');

    const attendance = await prisma.eventAttendance.findUnique({
        where: { eventId_userId: { eventId: payload.eventId, userId: payload.userId } },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    if (!attendance) {
        return { status: 'invalid', reason: 'Registro no encontrado', valid: false };
    }

    if (attendance.status === 'CANCELLED') {
        return { status: 'invalid', reason: 'Registro cancelado', valid: false };
    }

    if (new Date(event.eventDate).getTime() < Date.now()) {
        return { status: 'expired', reason: 'Evento finalizado', valid: false };
    }

    if (attendance.checkedInAt) {
        return {
            status: 'already_verified',
            reason: 'Ya verificado',
            valid: false,
            checkedInAt: attendance.checkedInAt,
            attendee: attendance.user,
        };
    }

    const updated = await prisma.eventAttendance.update({
        where: { id: attendance.id },
        data: {
            checkedInAt: new Date(),
            lastVerifiedAt: new Date(),
            verificationCount: (attendance.verificationCount ?? 0) + 1,
        },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });

    console.info('[event-qr] verified', { eventId: payload.eventId, userId: payload.userId, checkedInAt: updated.checkedInAt });

    return {
        status: 'valid',
        reason: 'Acceso válido',
        valid: true,
        checkedInAt: updated.checkedInAt,
        attendee: updated.user,
    };
}

export async function toggleAttendance(eventId: string, userId: string) {
    return registerAttendance(eventId, userId);
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
