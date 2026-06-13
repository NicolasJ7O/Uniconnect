import { prisma } from '../../lib/prisma.js';
import { emitToUser } from '../../lib/socket.js';
import { AppError } from '../../errors/app-error.js';
import { decorateMessage } from './decorators/message.decorator.js';
import { chatSubject } from './observers/index.js';
import { createPollForMessageInTransaction, getPollById, serializePollRecord, voteOnPoll } from './polls/poll.service.js';

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
  }) {
    const { groupId, senderId, content, fileUrl, fileName, fileType, poll } = data;

    const group = await prisma.studyGroup.findUnique({
      where: { id: groupId },
      include: { members: true },
    });

    if (!group) throw new AppError(404, 'Grupo no encontrado');

    const isMember = group.members.some((m) => m.id === senderId) || group.ownerId === senderId;
    if (!isMember) throw new AppError(403, 'No perteneces a este grupo');

    // Apply decorators to the content using the helper
    const memberNames = group.members.map(m => m.name || '').filter(Boolean);
    const processedContent = decorateMessage(content, { memberNames });

    const messageWithDecorations = await prisma.$transaction(async (tx) => {
      const createdMessage = await tx.message.create({
        data: {
          content: processedContent,
          senderId,
          groupId,
          isPrivate: false,
          fileUrl,
          fileName,
          fileType,
        },
      });

      if (poll) {
        await createPollForMessageInTransaction(tx, {
          groupId,
          messageId: createdMessage.id,
          creatorId: senderId,
          question: poll.question || content || 'Encuesta sin título',
          options: poll.options,
          allowMultiple: poll.allowMultiple,
          maxSelections: poll.maxSelections,
          closingAt: poll.closingAt,
          durationMinutes: poll.durationMinutes,
        });
      }

      return tx.message.findUnique({
        where: { id: createdMessage.id },
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
    });

    const normalizedMessage = messageWithDecorations
      ? {
          ...messageWithDecorations,
          poll: messageWithDecorations.poll ? serializePollRecord(messageWithDecorations.poll as any) : undefined,
        }
      : null;

    // Notify observers (Observer Pattern)
    await chatSubject.notify('NUEVO_MENSAJE', {
      isPrivate: false,
      message: normalizedMessage
    });

    // Notifications logic
    for (const member of group.members) {
      if (String(member.id) !== String(senderId)) {
        const memberFirstName = member.name?.split(' ')[0];
        const isMentioned = !!memberFirstName && content.includes(`@${memberFirstName}`);

        let notificationType = 'GROUP_MESSAGE';
        let notificationMsg = `Nuevo mensaje en el grupo ${group.name}`;

        if (isMentioned) {
          notificationType = 'MENTION';
          notificationMsg = `Te han mencionado en el grupo ${group.name}`;
        }

        const notif = await prisma.notification.create({
          data: {
            userId: member.id,
            type: notificationType,
            message: notificationMsg,
          }
        });

        emitToUser(member.id, 'new-notification', {
          ...notif,
          groupId: group.id,
          groupName: group.name
        });
      }
    }

    if (!normalizedMessage) {
      throw new AppError(500, 'No se pudo crear el mensaje');
    }

    return normalizedMessage;
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
  }) {
    const { senderId, receiverId, content, fileUrl, fileName, fileType } = data;
    
    // Recupera la otra persona para poder decorarle la mención si existe
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId }
    });

    const memberNames = receiver && receiver.name ? [receiver.name] : [];
    const processedContent = decorateMessage(content, { memberNames });

    const message = await prisma.message.create({
      data: {
        content: processedContent,
        senderId,
        receiverId,
        isPrivate: true,
        fileUrl,
        fileName,
        fileType,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    // Notify observers (Observer Pattern)
    await chatSubject.notify('NUEVO_MENSAJE', {
      isPrivate: true,
      message
    });

    // Notification logic
    if (String(receiverId) !== String(senderId)) {
      const notif = await prisma.notification.create({
        data: {
          userId: receiverId,
          type: 'PRIVATE_MESSAGE',
          message: `Nuevo mensaje privado de ${message.sender.name}`,
        }
      });
      emitToUser(receiverId, 'new-notification', {
        ...notif,
        senderId: senderId,
        senderName: message.sender.name || 'Usuario'
      });
    }

    return message;
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
