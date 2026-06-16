import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import { Logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';

const logger = Logger.getInstance();

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildQuestionGroup(question: string) {
  return normalizeText(question);
}

async function triggerN8nAlert(question: string, count: number) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL || process.env.N8N_US_N8N03_URL;
  if (!webhookUrl) {
    logger.warn('n8n webhook not configured; skipping recurring feedback alert', { question, count });
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'US-N8N03',
        question,
        count,
        severity: 'high',
        createdAt: new Date().toISOString(),
      }),
    });
  } catch (error) {
    logger.error('Failed to notify n8n for recurring feedback', {
      question,
      count,
      error: error instanceof Error ? error.message : error,
    });
  }
}

export async function submitAssistantFeedback(input: {
  userId: string;
  assistantMessageId: string;
  sessionId?: string;
  question: string;
  answer: string;
  rating: string;
  comment?: string;
  chunks?: unknown;
  metadata?: unknown;
}) {
  const userId = input.userId?.trim();
  const assistantMessageId = input.assistantMessageId?.trim();
  const question = input.question?.trim();
  const answer = input.answer?.trim();
  const rating = input.rating?.toUpperCase() === 'USEFUL' ? 'USEFUL' : 'NOT_USEFUL';

  if (!userId) throw new AppError(400, 'El usuario es obligatorio');
  if (!assistantMessageId) throw new AppError(400, 'La interacción del chatbot es obligatoria');
  if (!question || !answer) throw new AppError(400, 'Pregunta y respuesta son obligatorias');

  const existing = await prisma.assistantFeedback.findUnique({
    where: {
      userId_assistantMessageId: {
        userId,
        assistantMessageId,
      },
    },
  });

  const payload: Prisma.AssistantFeedbackUncheckedCreateInput = {
    userId,
    assistantMessageId,
    sessionId: input.sessionId ?? null,
    question,
    answer,
    rating,
    comment: input.comment?.trim() || null,
    chunks: (input.chunks === undefined ? Prisma.JsonNull : input.chunks) as Prisma.InputJsonValue,
    metadata: (input.metadata === undefined ? Prisma.JsonNull : input.metadata) as Prisma.InputJsonValue,
  };

  const saved = existing
    ? await prisma.assistantFeedback.update({
        where: { id: existing.id },
        data: payload as Prisma.AssistantFeedbackUncheckedUpdateInput,
      })
    : await prisma.assistantFeedback.create({ data: payload });

  if (rating === 'NOT_USEFUL') {
    const recurringCount = await prisma.assistantFeedback.count({
      where: {
        question: { equals: question, mode: 'insensitive' },
        rating: 'NOT_USEFUL',
      },
    });

    if (recurringCount >= 3) {
      await triggerN8nAlert(question, recurringCount);
    }
  }

  return saved;
}

export async function getAssistantFeedbackReport(input: {
  page?: number;
  pageSize?: number;
  rating?: string;
  startDate?: string;
  endDate?: string;
  role?: string;
  minFrequency?: number;
}) {
  const page = Math.max(1, Number(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(input.pageSize ?? 10)));
  const rating = input.rating?.toUpperCase() || 'NOT_USEFUL';

  const where: Prisma.AssistantFeedbackWhereInput = {
    rating,
    ...(input.startDate || input.endDate
      ? {
          createdAt: {
            gte: input.startDate ? new Date(input.startDate) : undefined,
            lte: input.endDate ? new Date(input.endDate) : undefined,
          },
        }
      : {}),
  };

  const items = await prisma.assistantFeedback.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  const grouped = items.reduce<Record<string, { question: string; count: number; items: typeof items; firstSeen: Date; lastSeen: Date; }>>((acc, record) => {
    const groupKey = buildQuestionGroup(record.question);
    const current = acc[groupKey] ?? { question: record.question, count: 0, items: [], firstSeen: record.createdAt, lastSeen: record.createdAt };
    current.count += 1;
    current.items.push(record);
    current.firstSeen = record.createdAt < current.firstSeen ? record.createdAt : current.firstSeen;
    current.lastSeen = record.createdAt > current.lastSeen ? record.createdAt : current.lastSeen;
    acc[groupKey] = current;
    return acc;
  }, {});

  const filteredGroups = Object.values(grouped)
    .filter((group) => (input.minFrequency ? group.count >= Number(input.minFrequency) : true))
    .filter((group) => (input.role ? group.items.some((item) => item.user?.role === input.role) : true))
    .sort((left, right) => right.count - left.count || left.question.localeCompare(right.question));

  const total = filteredGroups.length;
  const pagedGroups = filteredGroups.slice((page - 1) * pageSize, page * pageSize);

  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    items: pagedGroups.map((group) => ({
      question: group.question,
      count: group.count,
      firstSeen: group.firstSeen.toISOString(),
      lastSeen: group.lastSeen.toISOString(),
      samples: group.items.slice(0, 5).map((item) => ({
        id: item.id,
        userId: item.userId,
        userRole: item.user?.role ?? 'student',
        answer: item.answer,
        comment: item.comment,
        createdAt: item.createdAt.toISOString(),
      })),
    })),
  };
}

export async function exportAssistantFeedbackCsv() {
  const items = await prisma.assistantFeedback.findMany({
    where: { rating: 'NOT_USEFUL' },
    orderBy: { createdAt: 'desc' },
    include: { user: true },
  });

  const header = ['id', 'userId', 'role', 'question', 'answer', 'rating', 'comment', 'createdAt'];
  const lines = items.map((item) => [
    item.id,
    item.userId,
    item.user?.role ?? '',
    item.question.replace(/"/g, '""'),
    item.answer.replace(/"/g, '""'),
    item.rating,
    (item.comment ?? '').replace(/"/g, '""'),
    item.createdAt.toISOString(),
  ].map((value) => `"${value}"`).join(','));

  return [header.join(','), ...lines].join('\n');
}
