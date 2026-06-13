import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { emitToUser } from '../../lib/socket.js';
import {
  createSystemNotification
} from '../notification/notification.service.js';
import {
  buildRecurrenceOccurrences,
  buildReminderSchedule,
} from './recurrence.service.js';
import type {
  CreateStudySessionInput,
  UpdateStudySessionInput,
  UpdateStudySessionSeriesInput,
} from './study-session.schemas.js';

type PrismaTx = any;

const sessionRelations = {
  subject: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  creator: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  participants: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  },
  reminders: {
    orderBy: {
      minutesBefore: 'asc' as const,
    },
  },
  series: true,
};

function toUniqueUserIds(userIds: string[]) {
  return Array.from(new Set(userIds.filter(Boolean)));
}

function normalizeReminders(reminders?: Array<{ minutesBefore: number }> | number[]) {
  const values = reminders
    ? reminders.map((item) => typeof item === 'number' ? item : item.minutesBefore)
    : [15];
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

async function ensureUsersExist(userIds: string[]) {
  if (userIds.length === 0) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true },
  });

  if (users.length !== userIds.length) {
    const found = new Set(users.map((user) => user.id));
    const missing = userIds.filter((userId) => !found.has(userId));
    throw new AppError(404, `Usuarios no encontrados: ${missing.join(', ')}`);
  }

  return users.map((user) => user.id);
}

function getRelevantUserIds(creatorId: string, participantIds: string[]) {
  return toUniqueUserIds([creatorId, ...participantIds]);
}

async function validateSessionWindow(
  startAt: Date,
  endAt: Date,
  userIds: string[],
  ignoreSessionIds: string[] = []
) {
  const conflicts = await prisma.sesionEstudioBase.findMany({
    where: {
      status: 'SCHEDULED',
      ...(ignoreSessionIds.length ? { id: { notIn: ignoreSessionIds } } : {}),
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      OR: [
        { creatorId: { in: userIds } },
        { participants: { some: { userId: { in: userIds } } } },
      ],
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
    },
    take: 1,
  });

  if (conflicts.length > 0) {
    const conflict = conflicts[0];
    throw new AppError(
      409,
      `La sesion se solapa con "${conflict.title}" programada para ${conflict.startAt.toISOString()}`
    );
  }
}

async function createReminders(
  tx: PrismaTx,
  sessionId: string,
  startAt: Date,
  reminderMinutes: number[]
) {
  const reminders = buildReminderSchedule(startAt, reminderMinutes);
  if (!reminders.length) {
    return;
  }

  await tx.sesionEstudioRecordatorio.createMany({
    data: reminders.map((reminder) => ({
      sessionId,
      minutesBefore: reminder.minutesBefore,
      scheduledAt: reminder.scheduledAt,
      channel: 'DATABASE',
    })),
    skipDuplicates: true,
  });
}

async function createParticipants(
  tx: PrismaTx,
  sessionId: string,
  participantIds: string[]
) {
  if (!participantIds.length) {
    return;
  }

  await tx.sesionEstudioParticipante.createMany({
    data: participantIds.map((userId) => ({ sessionId, userId })),
    skipDuplicates: true,
  });
}

async function serializeSession(sessionId: string) {
  return prisma.sesionEstudioBase.findUnique({
    where: { id: sessionId },
    include: sessionRelations,
  });
}

function buildSeriesPayload(data: CreateStudySessionInput | UpdateStudySessionSeriesInput) {
  if (!data.recurrence) {
    return null;
  }

  return {
    frequency: data.recurrence.frequency,
    interval: data.recurrence.interval,
    endDate: data.recurrence.endDate,
    daysOfWeek: data.recurrence.daysOfWeek ?? null,
    dayOfMonth: data.recurrence.dayOfMonth ?? null,
  };
}

async function createOccurrence(
  tx: PrismaTx,
  data: {
    title: string;
    description?: string;
    subjectId: string;
    creatorId: string;
    startAt: Date;
    durationMinutes: number;
    seriesId?: string | null;
    occurrenceIndex: number;
    participantIds: string[];
    reminderMinutes: number[];
  }
) {
  const endAt = new Date(data.startAt.getTime() + data.durationMinutes * 60 * 1000);
  const session = await tx.sesionEstudioBase.create({
    data: {
      title: data.title,
      description: data.description,
      subjectId: data.subjectId,
      creatorId: data.creatorId,
      startAt: data.startAt,
      endAt,
      durationMinutes: data.durationMinutes,
      seriesId: data.seriesId ?? null,
      occurrenceIndex: data.occurrenceIndex,
    },
  });

  await createParticipants(tx, session.id, data.participantIds);
  await createReminders(tx, session.id, data.startAt, data.reminderMinutes);

  return session;
}

async function regenerateFutureOccurrences(params: {
  seriesId: string;
  creatorId: string;
  participantIds: string[];
  title: string;
  description?: string;
  subjectId: string;
  baseStartAt: Date;
  durationMinutes: number;
  recurrence: NonNullable<CreateStudySessionInput['recurrence']>;
  reminderMinutes: number[];
  effectiveFrom: Date;
}) {
  const occurrences = buildRecurrenceOccurrences(params.baseStartAt, params.recurrence)
    .filter((occurrence) => occurrence.getTime() >= params.effectiveFrom.getTime());

  await validateOccurrences(
    occurrences,
    params.durationMinutes,
    getRelevantUserIds(params.creatorId, params.participantIds),
    []
  );

  const createdSessions: Array<{ id: string }> = [];

  await prisma.$transaction(async (tx) => {
    const futureSessions = await tx.sesionEstudioBase.findMany({
      where: {
        seriesId: params.seriesId,
        startAt: { gte: params.effectiveFrom },
        status: 'SCHEDULED',
      },
      select: { id: true },
    });

    const futureSessionIds = futureSessions.map((session) => session.id);

    if (futureSessionIds.length > 0) {
      await tx.sesionEstudioRecordatorio.deleteMany({
        where: { sessionId: { in: futureSessionIds } },
      });

      await tx.sesionEstudioParticipante.deleteMany({
        where: { sessionId: { in: futureSessionIds } },
      });

      await tx.sesionEstudioBase.deleteMany({
        where: { id: { in: futureSessionIds } },
      });
    }

    await tx.sesionEstudioSerie.update({
      where: { id: params.seriesId },
      data: {
        title: params.title,
        description: params.description,
        subjectId: params.subjectId,
        baseStartAt: params.baseStartAt,
        durationMinutes: params.durationMinutes,
        recurrenceConfig: buildSeriesPayload({ recurrence: params.recurrence } as any) as any,
        reminderMinutes: params.reminderMinutes as any,
      },
    });

    let occurrenceIndex = 0;
    for (const occurrenceStartAt of occurrences) {
      occurrenceIndex += 1;
      const session = await createOccurrence(tx, {
        title: params.title,
        description: params.description,
        subjectId: params.subjectId,
        creatorId: params.creatorId,
        startAt: occurrenceStartAt,
        durationMinutes: params.durationMinutes,
        seriesId: params.seriesId,
        occurrenceIndex,
        participantIds: params.participantIds,
        reminderMinutes: params.reminderMinutes,
      });
      createdSessions.push({ id: session.id });
    }
  });

  return createdSessions;
}

async function validateOccurrences(
  occurrences: Date[],
  durationMinutes: number,
  userIds: string[],
  ignoreSessionIds: string[]
) {
  for (const occurrenceStartAt of occurrences) {
    const occurrenceEndAt = new Date(occurrenceStartAt.getTime() + durationMinutes * 60 * 1000);
    await validateSessionWindow(occurrenceStartAt, occurrenceEndAt, userIds, ignoreSessionIds);
  }
}

export async function getMyStudySessions(userId: string) {
  return prisma.sesionEstudioBase.findMany({
    where: {
      OR: [
        { creatorId: userId },
        { participants: { some: { userId } } },
      ],
    },
    include: sessionRelations,
    orderBy: { startAt: 'asc' },
  });
}

export async function getStudySessionById(sessionId: string, userId: string) {
  const session = await prisma.sesionEstudioBase.findFirst({
    where: {
      id: sessionId,
      OR: [
        { creatorId: userId },
        { participants: { some: { userId } } },
      ],
    },
    include: sessionRelations,
  });

  if (!session) {
    throw new AppError(404, 'Sesion de estudio no encontrada');
  }

  return session;
}

export async function createStudySession(userId: string, data: CreateStudySessionInput) {
  const subject = await prisma.subject.findUnique({
    where: { id: data.subjectId },
    select: { id: true, name: true },
  });

  if (!subject) {
    throw new AppError(404, 'Asignatura no encontrada');
  }

  const participantIds = await ensureUsersExist(toUniqueUserIds(data.participantIds).filter((id) => id !== userId));
  const creatorId = userId;
  const reminderMinutes = normalizeReminders(data.reminders);
  const startAt = new Date(data.startAt);
  const durationMinutes = data.durationMinutes;
  const baseUsers = getRelevantUserIds(creatorId, participantIds);

  if (startAt.getTime() < Date.now()) {
    throw new AppError(400, 'La fecha de inicio debe ser futura');
  }

  if (data.recurrence) {
    const recurrenceOccurrences = buildRecurrenceOccurrences(startAt, data.recurrence);
    if (recurrenceOccurrences.length === 0) {
      throw new AppError(400, 'La serie recurrente no genera ocurrencias en el rango configurado');
    }

    await validateOccurrences(recurrenceOccurrences, durationMinutes, baseUsers, []);

    const series = await prisma.$transaction(async (tx) => {
      const createdSeries = await tx.sesionEstudioSerie.create({
        data: {
          title: data.title,
          description: data.description,
          subjectId: subject.id,
          creatorId,
          baseStartAt: startAt,
          durationMinutes,
          recurrenceConfig: buildSeriesPayload(data) as any,
          reminderMinutes: reminderMinutes as any,
        },
      });

      let occurrenceIndex = 0;
      for (const occurrenceStartAt of recurrenceOccurrences) {
        occurrenceIndex += 1;
        await createOccurrence(tx, {
          title: data.title,
          description: data.description,
          subjectId: subject.id,
          creatorId,
          startAt: occurrenceStartAt,
          durationMinutes,
          seriesId: createdSeries.id,
          occurrenceIndex,
          participantIds,
          reminderMinutes,
        });
      }

      return createdSeries;
    });

    const session = await prisma.sesionEstudioSerie.findUnique({
      where: { id: series.id },
      include: {
        sessions: {
          include: sessionRelations,
          orderBy: { startAt: 'asc' },
        },
      },
    });

    for (const recipientId of baseUsers) {
      emitToUser(recipientId, 'study-session-updated', {
        action: 'created',
        seriesId: series.id,
      });
    }

    return session;
  }

  await validateSessionWindow(
    startAt,
    new Date(startAt.getTime() + durationMinutes * 60 * 1000),
    baseUsers,
    []
  );

  const session = await prisma.$transaction(async (tx) => {
    const created = await createOccurrence(tx, {
      title: data.title,
      description: data.description,
      subjectId: subject.id,
      creatorId,
      startAt,
      durationMinutes,
      participantIds,
      reminderMinutes,
      occurrenceIndex: 1,
    });

    return tx.sesionEstudioBase.findUnique({
      where: { id: created.id },
      include: sessionRelations,
    });
  });

  if (!session) {
    throw new AppError(500, 'No se pudo crear la sesion de estudio');
  }

  for (const recipientId of baseUsers) {
    emitToUser(recipientId, 'study-session-updated', {
      action: 'created',
      sessionId: session.id,
    });
  }

  return session;
}

export async function updateStudySession(userId: string, sessionId: string, data: UpdateStudySessionInput) {
  const session = await prisma.sesionEstudioBase.findUnique({
    where: { id: sessionId },
    include: {
      series: true,
      participants: true,
    },
  });

  if (!session) {
    throw new AppError(404, 'Sesion de estudio no encontrada');
  }

  if (session.creatorId !== userId) {
    throw new AppError(403, 'Solo el creador puede modificar la sesion');
  }

  if (session.startAt < new Date()) {
    throw new AppError(400, 'No se puede modificar una sesion historica');
  }

  const participantIds = data.participantIds
    ? await ensureUsersExist(toUniqueUserIds(data.participantIds).filter((id) => id !== userId))
    : session.participants.map((participant) => participant.userId);
  const reminderMinutes = normalizeReminders(
    data.reminders
      ?? (Array.isArray(session.series?.reminderMinutes) ? (session.series?.reminderMinutes as number[]) : [15])
  );
  const nextStartAt = data.startAt ? new Date(data.startAt) : session.startAt;
  const durationMinutes = data.durationMinutes ?? session.durationMinutes;
  const nextEndAt = new Date(nextStartAt.getTime() + durationMinutes * 60 * 1000);

  if (nextStartAt.getTime() < Date.now()) {
    throw new AppError(400, 'La fecha de inicio debe ser futura');
  }

  await validateSessionWindow(nextStartAt, nextEndAt, getRelevantUserIds(userId, participantIds), [sessionId]);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.sesionEstudioParticipante.deleteMany({ where: { sessionId } });
    await tx.sesionEstudioRecordatorio.deleteMany({ where: { sessionId } });

    const result = await tx.sesionEstudioBase.update({
      where: { id: sessionId },
      data: {
        title: data.title ?? session.title,
        description: data.description ?? session.description,
        startAt: nextStartAt,
        endAt: nextEndAt,
        durationMinutes,
      },
    });

    await createParticipants(tx, sessionId, participantIds);
    await createReminders(tx, sessionId, nextStartAt, reminderMinutes);

    return tx.sesionEstudioBase.findUnique({
      where: { id: result.id },
      include: sessionRelations,
    });
  });

  if (!updated) {
    throw new AppError(500, 'No se pudo actualizar la sesion');
  }

  const recipientIds = getRelevantUserIds(userId, participantIds);
  for (const recipientId of recipientIds) {
    emitToUser(recipientId, 'study-session-updated', {
      action: 'updated',
      sessionId: updated.id,
    });
  }

  return updated;
}

export async function updateStudySessionSeries(
  userId: string,
  seriesId: string,
  data: UpdateStudySessionSeriesInput
) {
  const series = await prisma.sesionEstudioSerie.findUnique({
    where: { id: seriesId },
    include: {
      sessions: {
        where: { status: 'SCHEDULED' },
        orderBy: { startAt: 'asc' },
        include: {
          participants: true,
        },
      },
    },
  });

  if (!series) {
    throw new AppError(404, 'Serie de estudio no encontrada');
  }

  if (series.creatorId !== userId) {
    throw new AppError(403, 'Solo el creador puede modificar la serie');
  }

  const effectiveFrom = data.effectiveFrom ? new Date(data.effectiveFrom) : new Date();
  const nextTitle = data.title ?? series.title;
  const nextDescription = data.description ?? series.description ?? undefined;
  const nextSubjectId = data.subjectId ?? series.subjectId;
  const nextStartAt = data.startAt ? new Date(data.startAt) : series.baseStartAt;
  const nextDurationMinutes = data.durationMinutes ?? series.durationMinutes;
  const nextRecurrence = data.recurrence
    ? data.recurrence
    : (series.recurrenceConfig as any);
  const nextReminderMinutes = normalizeReminders(data.reminders ?? (series.reminderMinutes as number[] | undefined) ?? [15]);
  const participantIds = data.participantIds
    ? await ensureUsersExist(toUniqueUserIds(data.participantIds).filter((id) => id !== userId))
    : Array.from(new Set(series.sessions.flatMap((session) => session.participants.map((participant) => participant.userId))))
        .filter((id) => id !== userId);

  if (!nextRecurrence) {
    throw new AppError(400, 'La serie debe conservar una regla de recurrencia valida');
  }

  const occurrenceCandidates = buildRecurrenceOccurrences(nextStartAt, nextRecurrence).filter(
    (occurrence) => occurrence.getTime() >= effectiveFrom.getTime()
  );

  if (occurrenceCandidates.length === 0) {
    throw new AppError(400, 'La configuracion no genera futuras ocurrencias');
  }

  await validateOccurrences(
    occurrenceCandidates,
    nextDurationMinutes,
    getRelevantUserIds(userId, participantIds),
    series.sessions
      .filter((session) => session.startAt >= effectiveFrom)
      .map((session) => session.id)
  );

  const updated = await prisma.$transaction(async (tx) => {
    const futureSessions = await tx.sesionEstudioBase.findMany({
      where: {
        seriesId,
        startAt: { gte: effectiveFrom },
        status: 'SCHEDULED',
      },
      select: { id: true },
    });

    const futureSessionIds = futureSessions.map((session) => session.id);

    if (futureSessionIds.length > 0) {
      await tx.sesionEstudioRecordatorio.deleteMany({ where: { sessionId: { in: futureSessionIds } } });
      await tx.sesionEstudioParticipante.deleteMany({ where: { sessionId: { in: futureSessionIds } } });
      await tx.sesionEstudioBase.deleteMany({ where: { id: { in: futureSessionIds } } });
    }

    const updatedSeries = await tx.sesionEstudioSerie.update({
      where: { id: seriesId },
      data: {
        title: nextTitle,
        description: nextDescription,
        subjectId: nextSubjectId,
        baseStartAt: nextStartAt,
        durationMinutes: nextDurationMinutes,
        recurrenceConfig: buildSeriesPayload({ recurrence: nextRecurrence } as any) as any,
        reminderMinutes: nextReminderMinutes as any,
        status: 'SCHEDULED',
        canceledAt: null,
      },
    });

    let occurrenceIndex = 0;
    for (const occurrenceStartAt of occurrenceCandidates) {
      occurrenceIndex += 1;
      await createOccurrence(tx, {
        title: nextTitle,
        description: nextDescription,
        subjectId: nextSubjectId,
        creatorId: userId,
        startAt: occurrenceStartAt,
        durationMinutes: nextDurationMinutes,
        seriesId: updatedSeries.id,
        occurrenceIndex,
        participantIds,
        reminderMinutes: nextReminderMinutes,
      });
    }

    return tx.sesionEstudioSerie.findUnique({
      where: { id: updatedSeries.id },
      include: {
        sessions: {
          include: sessionRelations,
          orderBy: { startAt: 'asc' },
        },
      },
    });
  });

  if (!updated) {
    throw new AppError(500, 'No se pudo actualizar la serie');
  }

  for (const recipientId of getRelevantUserIds(userId, participantIds)) {
    emitToUser(recipientId, 'study-session-updated', {
      action: 'series-updated',
      seriesId,
    });
  }

  return updated;
}

export async function cancelStudySession(userId: string, sessionId: string, reason?: string) {
  const session = await prisma.sesionEstudioBase.findUnique({
    where: { id: sessionId },
    include: { participants: true },
  });

  if (!session) {
    throw new AppError(404, 'Sesion de estudio no encontrada');
  }

  if (session.creatorId !== userId) {
    throw new AppError(403, 'Solo el creador puede cancelar la sesion');
  }

  if (session.startAt < new Date()) {
    throw new AppError(400, 'No se puede cancelar una sesion historica');
  }

  await prisma.$transaction(async (tx) => {
    await tx.sesionEstudioRecordatorio.deleteMany({ where: { sessionId } });
    await tx.sesionEstudioParticipante.deleteMany({ where: { sessionId } });
    await tx.sesionEstudioBase.delete({ where: { id: sessionId } });
  });

  for (const recipientId of getRelevantUserIds(userId, session.participants.map((participant) => participant.userId))) {
    emitToUser(recipientId, 'study-session-updated', {
      action: 'canceled',
      sessionId,
      reason,
    });
  }

  return { canceled: true };
}

export async function cancelStudySessionSeries(userId: string, seriesId: string) {
  const series = await prisma.sesionEstudioSerie.findUnique({
    where: { id: seriesId },
    include: {
      sessions: {
        where: { startAt: { gte: new Date() }, status: 'SCHEDULED' },
        include: { participants: true },
      },
    },
  });

  if (!series) {
    throw new AppError(404, 'Serie de estudio no encontrada');
  }

  if (series.creatorId !== userId) {
    throw new AppError(403, 'Solo el creador puede cancelar la serie');
  }

  const futureSessionIds = series.sessions.map((session) => session.id);
  const recipients = toUniqueUserIds([
    userId,
    ...series.sessions.flatMap((session) => session.participants.map((participant) => participant.userId)),
  ]);

  await prisma.$transaction(async (tx) => {
    if (futureSessionIds.length > 0) {
      await tx.sesionEstudioRecordatorio.deleteMany({ where: { sessionId: { in: futureSessionIds } } });
      await tx.sesionEstudioParticipante.deleteMany({ where: { sessionId: { in: futureSessionIds } } });
      await tx.sesionEstudioBase.deleteMany({ where: { id: { in: futureSessionIds } } });
    }

    await tx.sesionEstudioSerie.update({
      where: { id: seriesId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
    });
  });

  for (const recipientId of recipients) {
    emitToUser(recipientId, 'study-session-updated', {
      action: 'series-canceled',
      seriesId,
    });
  }

  return { canceled: true };
}

export async function processStudySessionReminders() {
  const now = new Date();
  const dueReminders = await prisma.sesionEstudioRecordatorio.findMany({
    where: {
      sentAt: null,
      scheduledAt: { lte: now },
      session: {
        status: 'SCHEDULED',
        startAt: { gt: now },
      },
    },
    include: {
      session: {
        include: {
          subject: { select: { id: true, name: true } },
          creator: { select: { id: true, name: true, email: true } },
          participants: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 50,
  });

  for (const reminder of dueReminders) {
    const claimed = await prisma.sesionEstudioRecordatorio.updateMany({
      where: {
        id: reminder.id,
        sentAt: null,
      },
      data: {
        sentAt: new Date(),
        channel: 'WEBSOCKET',
      },
    });

    if (claimed.count === 0) {
      continue;
    }

    const recipients = toUniqueUserIds([
      reminder.session.creatorId,
      ...reminder.session.participants.map((participant) => participant.userId),
    ]);

    for (const recipientId of recipients) {
      await createSystemNotification({
        userId: recipientId,
        type: 'STUDY_SESSION_REMINDER',
        message: `Recordatorio: "${reminder.session.title}" comienza a las ${reminder.session.startAt.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
        })}`,
        metadata: {
          sessionId: reminder.session.id,
          seriesId: reminder.session.seriesId,
          reminderId: reminder.id,
          minutesBefore: reminder.minutesBefore,
          subjectId: reminder.session.subjectId,
          subjectName: reminder.session.subject.name,
          startAt: reminder.session.startAt.toISOString(),
          accion: {
            label: 'Ver sesiones',
            endpoint: '/study-sessions',
          },
        },
      });
    }
  }
}
