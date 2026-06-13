import { PrismaClient, Prisma } from '@prisma/client';
import { AppError } from '../../../errors/app-error.js';
import { prisma } from '../../../lib/prisma.js';
import { pollSubject } from './index.js';

type PollWithRelations = Prisma.PollGetPayload<{ include: typeof pollIncludes }>;
type PollDatabase = Pick<PrismaClient, 'poll' | 'pollOption'>;

const pollIncludes = {
  creator: {
    select: {
      id: true,
      name: true,
      avatarUrl: true,
    },
  },
  options: {
    orderBy: {
      position: 'asc' as const,
    },
    include: {
      votes: {
        select: {
          userId: true,
          createdAt: true,
        },
      },
    },
  },
  message: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      senderId: true,
      groupId: true,
      isPrivate: true,
      fileUrl: true,
      fileName: true,
      fileType: true,
    },
  },
} as const;

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function serializePollRecord(poll: PollWithRelations) {
  const options = poll.options.map((option) => {
    const voterIds = uniqueStrings(option.votes.map((vote) => vote.userId));
    return {
      id: option.id,
      label: option.label,
      position: option.position,
      votes: voterIds.length,
      voterIds,
      percentage: 0,
    };
  });

  const totalVotes = options.reduce((sum, option) => sum + option.votes, 0);
  const participantIds = uniqueStrings(options.flatMap((option) => option.voterIds));

  const normalizedOptions = options.map((option) => ({
    ...option,
    percentage: totalVotes === 0 ? 0 : Number(((option.votes / totalVotes) * 100).toFixed(2)),
  }));

  return {
    id: poll.id,
    messageId: poll.messageId,
    groupId: poll.groupId,
    creatorId: poll.creatorId,
    question: poll.question,
    allowMultiple: poll.allowMultiple,
    maxSelections: poll.maxSelections,
    closingAt: poll.closingAt?.toISOString() ?? null,
    closedAt: poll.closedAt?.toISOString() ?? null,
    status: poll.status,
    createdAt: poll.createdAt.toISOString(),
    updatedAt: poll.updatedAt.toISOString(),
    totalVotes,
    participantCount: participantIds.length,
    participantIds,
    options: normalizedOptions,
    creator: poll.creator,
    message: poll.message,
  };
}

async function createPollRecord(db: PollDatabase, input: {
  messageId: string;
  groupId: string;
  creatorId: string;
  question: string;
  options: string[];
  allowMultiple?: boolean;
  maxSelections?: number;
  closingAt?: Date | null;
}) {
  const question = normalizePollQuestion(input.question);
  const options = normalizePollOptions(input.options);
  const allowMultiple = Boolean(input.allowMultiple);
  const maxSelections = allowMultiple
    ? Math.min(options.length, Math.max(2, input.maxSelections || 2))
    : 1;
  const closingAt = input.closingAt ?? null;

  if (closingAt && closingAt.getTime() <= Date.now()) {
    throw new AppError(400, 'La fecha de cierre debe ser futura');
  }

  const createdPoll = await db.poll.create({
    data: {
      messageId: input.messageId,
      groupId: input.groupId,
      creatorId: input.creatorId,
      question,
      allowMultiple,
      maxSelections,
      closingAt,
    },
  });

  await db.pollOption.createMany({
    data: options.map((label, position) => ({
      pollId: createdPoll.id,
      label,
      position,
    })),
  });

  const poll = await db.poll.findUnique({
    where: { id: createdPoll.id },
    include: pollIncludes,
  });

  if (!poll) {
    throw new AppError(500, 'No se pudo crear la encuesta');
  }

  return serializePollRecord(poll);
}

function normalizePollQuestion(question: string) {
  const normalized = question.trim();
  if (!normalized) {
    throw new AppError(400, 'La encuesta debe incluir una pregunta');
  }
  return normalized;
}

function normalizePollOptions(options: string[]) {
  const normalized = uniqueStrings(options.map((option) => option.trim()).filter(Boolean));

  if (normalized.length < 2) {
    throw new AppError(400, 'La encuesta debe tener al menos 2 opciones');
  }

  if (normalized.length > 10) {
    throw new AppError(400, 'La encuesta no puede tener más de 10 opciones');
  }

  return normalized;
}

function resolveClosingAt(input?: { closingAt?: string | Date | null; durationMinutes?: number | null }) {
  if (input?.closingAt) {
    const closingAt = new Date(input.closingAt);
    if (Number.isNaN(closingAt.getTime())) {
      throw new AppError(400, 'La fecha de cierre de la encuesta no es válida');
    }
    return closingAt;
  }

  if (typeof input?.durationMinutes === 'number') {
    if (input.durationMinutes <= 0) {
      throw new AppError(400, 'La duración de la encuesta debe ser mayor a cero');
    }
    return new Date(Date.now() + input.durationMinutes * 60 * 1000);
  }

  return null;
}

async function ensureGroupMembership(groupId: string, userId: string) {
  const group = await prisma.studyGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      ownerId: true,
      members: {
        select: { id: true },
      },
      name: true,
    },
  });

  if (!group) {
    throw new AppError(404, 'Grupo no encontrado');
  }

  const isMember = group.ownerId === userId || group.members.some((member) => member.id === userId);
  if (!isMember) {
    throw new AppError(403, 'Solo los miembros del grupo pueden participar en la encuesta');
  }

  return group;
}

async function getPollForGroup(groupId: string, pollId: string) {
  const poll = await prisma.poll.findFirst({
    where: {
      id: pollId,
      groupId,
    },
    include: pollIncludes,
  });

  if (!poll) {
    throw new AppError(404, 'Encuesta no encontrada');
  }

  return poll;
}

async function closePollRecord(pollId: string) {
  const now = new Date();

  const claimed = await prisma.poll.updateMany({
    where: {
      id: pollId,
      status: 'ACTIVE',
    },
    data: {
      status: 'CLOSED',
      closedAt: now,
    },
  });

  if (claimed.count === 0) {
    return null;
  }

  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: pollIncludes,
  });

  return poll ? serializePollRecord(poll) : null;
}

export async function createPollForMessage(input: {
  groupId: string;
  messageId: string;
  creatorId: string;
  question: string;
  options: string[];
  allowMultiple?: boolean;
  maxSelections?: number;
  closingAt?: string | Date | null;
  durationMinutes?: number | null;
}) {
  await ensureGroupMembership(input.groupId, input.creatorId);

  const closingAt = resolveClosingAt({
    closingAt: input.closingAt,
    durationMinutes: input.durationMinutes,
  });
  const serialized = await createPollRecord(prisma, {
    messageId: input.messageId,
    groupId: input.groupId,
    creatorId: input.creatorId,
    question: input.question,
    options: input.options,
    allowMultiple: input.allowMultiple,
    maxSelections: input.maxSelections,
    closingAt,
  });

  await pollSubject.notify('ENCUESTA_ACTUALIZADA', {
    groupId: input.groupId,
    poll: serialized,
  });

  return serialized;
}

export async function createPollForMessageInTransaction(db: PollDatabase, input: {
  messageId: string;
  groupId: string;
  creatorId: string;
  question: string;
  options: string[];
  allowMultiple?: boolean;
  maxSelections?: number;
  closingAt?: string | Date | null;
  durationMinutes?: number | null;
}) {
  const closingAt = resolveClosingAt({
    closingAt: input.closingAt,
    durationMinutes: input.durationMinutes,
  });

  return createPollRecord(db, {
    messageId: input.messageId,
    groupId: input.groupId,
    creatorId: input.creatorId,
    question: input.question,
    options: input.options,
    allowMultiple: input.allowMultiple,
    maxSelections: input.maxSelections,
    closingAt,
  });
}

export async function voteOnPoll(input: {
  groupId: string;
  pollId: string;
  userId: string;
  optionIds: string[];
}) {
  await ensureGroupMembership(input.groupId, input.userId);

  const poll = await prisma.poll.findFirst({
    where: {
      id: input.pollId,
      groupId: input.groupId,
    },
    include: pollIncludes,
  });

  if (!poll) {
    throw new AppError(404, 'Encuesta no encontrada');
  }

  if (poll.status === 'CLOSED') {
    throw new AppError(400, 'La encuesta ya está cerrada');
  }

  if (poll.closingAt && poll.closingAt.getTime() <= Date.now()) {
    const closedPoll = await closePollRecord(poll.id);
    if (closedPoll) {
      await pollSubject.notify('ENCUESTA_CERRADA', {
        groupId: input.groupId,
        poll: closedPoll,
      });
    }
    throw new AppError(400, 'La encuesta ya expiró y fue cerrada automáticamente');
  }

  const uniqueOptionIds = uniqueStrings(input.optionIds);
  if (uniqueOptionIds.length === 0) {
    throw new AppError(400, 'Debes seleccionar al menos una opción');
  }

  if (!poll.allowMultiple && uniqueOptionIds.length !== 1) {
    throw new AppError(400, 'Esta encuesta solo permite un voto');
  }

  if (poll.allowMultiple && uniqueOptionIds.length > poll.maxSelections) {
    throw new AppError(400, `Esta encuesta permite hasta ${poll.maxSelections} opciones por usuario`);
  }

  const validOptionIds = new Set(poll.options.map((option) => option.id));
  const invalidOptionId = uniqueOptionIds.find((optionId) => !validOptionIds.has(optionId));
  if (invalidOptionId) {
    throw new AppError(400, 'Una de las opciones seleccionadas no pertenece a la encuesta');
  }

  const userVotes = await prisma.pollVote.findMany({
    where: {
      pollId: poll.id,
      userId: input.userId,
    },
    select: {
      optionId: true,
    },
  });

  const votedOptionIds = new Set(userVotes.map((vote) => vote.optionId));
  const duplicateOptionId = uniqueOptionIds.find((optionId) => votedOptionIds.has(optionId));
  if (duplicateOptionId) {
    throw new AppError(400, 'Ya votaste en una de las opciones seleccionadas');
  }

  const totalVotesAfterInsert = votedOptionIds.size + uniqueOptionIds.length;
  if (!poll.allowMultiple && votedOptionIds.size > 0) {
    throw new AppError(400, 'Esta encuesta ya registra tu voto');
  }

  if (poll.allowMultiple && totalVotesAfterInsert > poll.maxSelections) {
    throw new AppError(400, `No puedes superar ${poll.maxSelections} selecciones en esta encuesta`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.pollVote.createMany({
      data: uniqueOptionIds.map((optionId) => ({
        pollId: poll.id,
        optionId,
        userId: input.userId,
      })),
      skipDuplicates: true,
    });
  });

  const updatedPoll = await prisma.poll.findUnique({
    where: { id: poll.id },
    include: pollIncludes,
  });

  if (!updatedPoll) {
    throw new AppError(500, 'No se pudo actualizar la encuesta');
  }

  const serialized = serializePollRecord(updatedPoll);
  await pollSubject.notify('ENCUESTA_ACTUALIZADA', {
    groupId: input.groupId,
    poll: serialized,
  });

  return serialized;
}

export async function closeExpiredPolls() {
  const now = new Date();
  const duePolls = await prisma.poll.findMany({
    where: {
      status: 'ACTIVE',
      closingAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      groupId: true,
    },
    take: 50,
  });

  for (const poll of duePolls) {
    const closedPoll = await closePollRecord(poll.id);
    if (closedPoll) {
      await pollSubject.notify('ENCUESTA_CERRADA', {
        groupId: poll.groupId,
        poll: closedPoll,
      });
    }
  }
}

export async function getPollById(groupId: string, pollId: string) {
  const poll = await getPollForGroup(groupId, pollId);
  return serializePollRecord(poll);
}

export async function serializePollForClient(groupId: string, pollId: string) {
  const poll = await getPollForGroup(groupId, pollId);
  return serializePollRecord(poll);
}
