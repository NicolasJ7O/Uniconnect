import { prisma } from '../../lib/prisma.js';
import { emitToUser } from '../../lib/socket.js';
import { AppError, ModerationError } from '../../errors/app-error.js';
import { decorateMessage } from './decorators/message.decorator.js';
import { chatSubject } from './observers/index.js';
import { createPollForMessageInTransaction, getPollById, serializePollRecord, voteOnPoll } from './polls/poll.service.js';
import { runModerationPipeline } from './handlers/moderation-pipeline.js';
import { checkAndEscalate } from './moderation-escalation.service.js';

// ─── Moderation rejection payloads ──────────────────────────────────────────
type Severity = 'low' | 'medium' | 'high';

interface ModerationRejectedPayload {
  moderationCode: string;
  message: string;
  severity: Severity;
  suggestion: string;
  whyUrl: string;
  blockedUntil?: string; // ISO string
}

const MODERATION_META: Record<string, { severity: Severity; suggestion: string; whyUrl: string }> = {
  MO_001: { severity: 'low',    suggestion: 'Acorta tu mensaje a menos de 1000 caracteres e inténtalo de nuevo.', whyUrl: '/normas#longitud' },
  MO_002: { severity: 'medium', suggestion: 'Revisa el lenguaje de tu mensaje y elimina palabras inapropiadas.',   whyUrl: '/normas#palabras' },
  MO_003: { severity: 'high',   suggestion: 'Estás enviando mensajes muy seguido. Espera a que se libere el bloqueo.', whyUrl: '/normas#spam' },
  MO_004: { severity: 'medium', suggestion: 'Evita incluir enlaces externos en los mensajes.',                      whyUrl: '/normas#enlaces' },
};

function buildRejectedPayload(
  code: string,
  message: string,
  blockedUntil?: Date
): ModerationRejectedPayload {
  const meta = MODERATION_META[code] ?? { severity: 'medium', suggestion: 'Revisa tu mensaje antes de enviarlo.', whyUrl: '/normas' };
  return {
    moderationCode: code,
    message,
    severity: meta.severity,
    suggestion: meta.suggestion,
    whyUrl: meta.whyUrl,
    ...(blockedUntil ? { blockedUntil: blockedUntil.toISOString() } : {})
  };
}

export class ChatService {
  async getGroupMessages(groupId: string, userId: string, page: number = 1, limit: number = 20) {
    // Validate membership
    const group = await prisma.studyGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) throw new AppError(404, 'Grupo no encontrado');
    const isMember = group.members.some((m) => m.id === userId) || group.ownerId === userId;
    if (!isMember) throw new AppError(403, 'No tienes acceso a este grupo');

    const totalCount = await prisma.message.count({
      where: { groupId, isPrivate: false },
    });

    const messages = await prisma.message.findMany({
      where: { groupId, isPrivate: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
        poll: {
          include: {
            creator: {
              select: { id: true, name: true, avatarUrl: true },
            },
            options: {
              orderBy: { position: 'asc' },
              include: {
                votes: {
                  select: {
                    userId: true,
                    createdAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      messages: messages.reverse().map((message) => ({
        ...message,
        poll: message.poll ? serializePollRecord(message.poll as any) : undefined,
      })),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  async sendGroupMessage(data: {
    groupId: string;
    senderId: string;
    content: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    poll?: {
      question?: string;
      options: string[];
      allowMultiple?: boolean;
      maxSelections?: number;
      closingAt?: string | Date | null;
      durationMinutes?: number | null;
    };
    ip?: string;
    metadata?: any;
  }) {
    const { groupId, senderId, content, fileUrl, fileName, fileType, poll, ip, metadata } = data;

    const result = await runModerationPipeline({
      userId: senderId,
      content,
      chatId: groupId,
      isPrivate: false,
      fileUrl,
      fileName,
      fileType,
      poll,
      ip,
      metadata,
    });

    if (!result.approved) {
      const code = result.moderationCode || 'MO_REJECTED';
      const payload = buildRejectedPayload(code, result.message || 'Mensaje rechazado', result.blockedUntil);
      emitToUser(senderId, 'moderation-rejected', payload);

      // Escalate to super_admin if spam block threshold is reached (fire & forget)
      if (code === 'MO_003') {
        checkAndEscalate(senderId).catch(() => {});
      }

      throw new ModerationError(code, result.message || 'Mensaje rechazado');
    }

    return result.savedMessage;
  }

  async getPoll(groupId: string, pollId: string, userId: string) {
    const group = await prisma.studyGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) throw new AppError(404, 'Grupo no encontrado');
    const isMember = group.members.some((m) => m.id === userId) || group.ownerId === userId;
    if (!isMember) throw new AppError(403, 'No tienes acceso a esta encuesta');

    return getPollById(groupId, pollId);
  }

  async voteOnGroupPoll(groupId: string, pollId: string, userId: string, optionIds: string[]) {
    return voteOnPoll({ groupId, pollId, userId, optionIds });
  }

  async getPrivateMessages(userId: string, otherUserId: string, page: number = 1, limit: number = 20) {
    const totalCount = await prisma.message.count({
      where: {
        isPrivate: true,
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
    });

    const messages = await prisma.message.findMany({
      where: {
        isPrivate: true,
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return {
      messages: messages.reverse(),
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  async sendPrivateMessage(data: {
    senderId: string;
    receiverId: string;
    content: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    ip?: string;
    metadata?: any;
  }) {
    const { senderId, receiverId, content, fileUrl, fileName, fileType, ip, metadata } = data;

    const result = await runModerationPipeline({
      userId: senderId,
      content,
      chatId: receiverId,
      isPrivate: true,
      fileUrl,
      fileName,
      fileType,
      ip,
      metadata,
    });

    if (!result.approved) {
      const code = result.moderationCode || 'MO_REJECTED';
      const payload = buildRejectedPayload(code, result.message || 'Mensaje rechazado', result.blockedUntil);
      emitToUser(senderId, 'moderation-rejected', payload);

      // Escalate to super_admin if spam block threshold is reached (fire & forget)
      if (code === 'MO_003') {
        checkAndEscalate(senderId).catch(() => {});
      }

      throw new ModerationError(code, result.message || 'Mensaje rechazado');
    }

    return result.savedMessage;
  }

  async getConversations(userId: string) {
    const messages = await prisma.message.findMany({
      where: {
        isPrivate: true,
        OR: [
          { senderId: userId },
          { receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    const conversationsMap = new Map<string, any>();

    for (const msg of messages) {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!otherUser) continue;
      
      if (!conversationsMap.has(otherUser.id)) {
        conversationsMap.set(otherUser.id, {
          user: otherUser,
          lastMessage: {
            content: msg.content,
            createdAt: msg.createdAt,
            fileUrl: msg.fileUrl
          }
        });
      }
    }

    return Array.from(conversationsMap.values());
  }
}

export const chatService = new ChatService();
