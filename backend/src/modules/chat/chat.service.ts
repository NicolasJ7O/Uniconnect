import { prisma } from '../../lib/prisma.js';
import { emitToUser } from '../../lib/socket.js';
import { AppError, ModerationError } from '../../errors/app-error.js';
import { decorateMessage } from './decorators/message.decorator.js';
import { chatSubject } from './observers/index.js';
import { createPollForMessageInTransaction, getPollById, serializePollRecord, voteOnPoll } from './polls/poll.service.js';
import { runModerationPipeline } from './handlers/moderation-pipeline.js';

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
      throw new ModerationError(result.moderationCode || 'MO_REJECTED', result.message || 'Mensaje rechazado');
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
      throw new ModerationError(result.moderationCode || 'MO_REJECTED', result.message || 'Mensaje rechazado');
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
