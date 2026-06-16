import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { Logger } from '../../lib/logger.js';
import * as notificationService from '../notification/notification.service.js';

const logger = Logger.getInstance();
const INVITE_TTL_HOURS = 72;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

// Previously invitations were dispatched via n8n email webhook. For in-app
// invitations we now create a system notification (persisted + websocket
// emit) targeted to the recipient user when the recipient exists in the
// system. We keep the old n8n function in comments for traceability but do
// not call it by default per product request (no email delivery).

export async function createEventInvitation(eventId: string, organizerId: string, email: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, organizerId: true },
  });

  if (!event) throw new AppError(404, 'Evento no encontrado');
  if (event.organizerId !== organizerId) throw new AppError(403, 'Solo el creador del evento puede invitar');

  const recipientEmail = normalizeEmail(email);
  if (!recipientEmail) throw new AppError(400, 'El correo institucional es obligatorio');

  const existing = await prisma.eventInvitation.findFirst({
    where: {
      eventId,
      email: recipientEmail,
      status: { in: ['pending'] },
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return { ...existing, duplicate: true };
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

  const invitation = await prisma.eventInvitation.create({
    data: {
      eventId,
      email: recipientEmail,
      token,
      status: 'pending',
      expiresAt,
    },
  });

  // Try to find a registered user by email to deliver an in-app notification
  try {
    const recipient = await prisma.user.findUnique({ where: { email: recipientEmail }, select: { id: true, name: true } });
    if (recipient) {
      await notificationService.createSystemNotification({
        userId: recipient.id,
        type: 'EVENT_INVITATION',
        message: `Has sido invitado al evento ${event.title}`,
        metadata: {
          eventId,
          invitationId: invitation.id,
          token,
          acceptEndpoint: `/events/invitations/accept/${token}`,
          rejectEndpoint: `/events/invitations/reject/${token}`,
          accion: { label: 'Ver Invitación', endpoint: `/events/invitations/accept/${token}` },
        },
      });
    } else {
      logger.info('Invitado no registrado en el sistema — no se enviará notificación in-app', { eventId, email: recipientEmail });
    }
  } catch (err) {
    logger.error('Fallo al crear notificación in-app para invitación', { error: err, eventId, email: recipientEmail });
  }

  return { ...invitation, duplicate: false };
}

export async function rejectEventInvitation(token: string, userId: string) {
  const invitation = await prisma.eventInvitation.findUnique({ where: { token } });
  if (!invitation) throw new AppError(404, 'Invitación no encontrada o inválida');

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } });
  if (!user) throw new AppError(401, 'Usuario no encontrado');
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) throw new AppError(403, 'Esta invitación no está asociada a tu correo institucional');

  if (invitation.status === 'consumed' || invitation.status === 'rejected' || new Date(invitation.expiresAt) < new Date()) {
    throw new AppError(410, 'Esta invitación ya no es válida');
  }

  await prisma.eventInvitation.update({ where: { id: invitation.id }, data: { status: 'rejected', consumedAt: new Date() } });

  // Notify organizer that the invite was rejected
  try {
    const event = await prisma.event.findUnique({ where: { id: invitation.eventId }, select: { organizerId: true, title: true } });
    if (event && event.organizerId) {
      await notificationService.createSystemNotification({
        userId: event.organizerId,
        type: 'INVITATION_REJECTED',
        message: `${user.name || user.email} rechazó la invitación al evento ${event.title}`,
        metadata: { eventId: invitation.eventId, invitationId: invitation.id },
      });
    }
  } catch (err) {
    logger.warn('No se pudo notificar al organizador sobre la invitación rechazada', { error: err, invitationId: invitation.id });
  }

  return { message: 'Invitación rechazada' };
}

export async function listEventInvitations(eventId: string, organizerId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });

  if (!event) throw new AppError(404, 'Evento no encontrado');
  if (event.organizerId !== organizerId) throw new AppError(403, 'Solo el creador del evento puede ver las invitaciones');

  return prisma.eventInvitation.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function consumeEventInvitation(token: string, userId: string) {
  const invitation = await prisma.eventInvitation.findUnique({ where: { token } });
  if (!invitation) {
    throw new AppError(410, 'Esta invitación ya no es válida. Contacta al creador del evento para solicitar una nueva.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) throw new AppError(401, 'Usuario no encontrado');
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new AppError(403, 'Esta invitación no está asociada a tu correo institucional');
  }

  if (invitation.status === 'consumed') {
    throw new AppError(410, 'Esta invitación ya fue consumida. Contacta al creador del evento para solicitar una nueva.');
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    await prisma.eventInvitation.update({
      where: { id: invitation.id },
      data: { status: 'expired', lastError: 'Token expirado' },
    });
    throw new AppError(410, 'Esta invitación ha expirado. Contacta al creador del evento para solicitar una nueva.');
  }

  await prisma.$transaction([
    prisma.eventInvitation.update({
      where: { id: invitation.id },
      data: { status: 'consumed', consumedAt: new Date() },
    }),
    prisma.eventAttendance.upsert({
      where: { eventId_userId: { eventId: invitation.eventId, userId } },
      update: { status: 'ACTIVE', checkedInAt: null, lastVerifiedAt: null, verificationCount: 0 },
      create: { eventId: invitation.eventId, userId, status: 'ACTIVE' },
    }),
  ]);

  return { message: 'Invitación aceptada', eventId: invitation.eventId, attending: true };
}
