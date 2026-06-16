import { randomUUID } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { Logger } from '../../lib/logger.js';

const logger = Logger.getInstance();
const INVITE_TTL_HOURS = 72;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function triggerN8nInvite(payload: {
  eventId: string;
  eventTitle: string;
  recipientEmail: string;
  token: string;
}) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || process.env.N8N_US_N8N03_URL;

  if (!webhookUrl) {
    logger.warn('n8n webhook not configured; skipping invitation email dispatch', payload);
    return;
  }

  const inviteUrl = `${process.env.APP_PUBLIC_URL || 'http://localhost:8081'}/events/invite/${payload.token}`;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: payload.eventId,
        eventTitle: payload.eventTitle,
        recipientEmail: payload.recipientEmail,
        token: payload.token,
        inviteUrl,
        kind: 'event-invitation',
      }),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook returned ${response.status}`);
    }
  } catch (error) {
    logger.error('Failed to dispatch private event invitation via n8n', {
      eventId: payload.eventId,
      email: payload.recipientEmail,
      token: payload.token,
      error,
    });
    throw error;
  }
}

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

  try {
    await triggerN8nInvite({
      eventId,
      eventTitle: event.title,
      recipientEmail,
      token,
    });
  } catch (error) {
    logger.warn('Invitation created but n8n delivery failed; keeping token pending for traceability', {
      invitationId: invitation.id,
      eventId,
      email: recipientEmail,
      error,
    });
  }

  return { ...invitation, duplicate: false };
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
