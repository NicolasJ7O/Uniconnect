import { prisma } from '../../../lib/prisma.js';
import { emitToUser } from '../../../lib/socket.js';
import { decorateMessage } from '../decorators/message.decorator.js';
import { chatSubject } from '../observers/index.js';
import { createPollForMessageInTransaction, serializePollRecord } from '../polls/poll.service.js';
import { ModerationHandler, ModerationContext, ModerationResult } from './moderation.handler.js';

export class PersistenciaHandler extends ModerationHandler {
  protected async process(ctx: ModerationContext): Promise<ModerationResult> {
    const { userId, content, chatId, isPrivate, fileUrl, fileName, fileType, poll } = ctx;

    if (isPrivate) {
      // 1. PERSIST PRIVATE MESSAGE
      const receiver = await prisma.user.findUnique({
        where: { id: chatId }
      });

      if (!receiver) {
        return {
          approved: false,
          message: 'Destinatario no encontrado',
          handler: 'PersistenciaHandler'
        };
      }

      const memberNames = receiver.name ? [receiver.name] : [];
      const processedContent = decorateMessage(content, { memberNames });

      const message = await prisma.message.create({
        data: {
          content: processedContent,
          senderId: userId,
          receiverId: chatId,
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
      if (String(chatId) !== String(userId)) {
        const notif = await prisma.notification.create({
          data: {
            userId: chatId,
            type: 'PRIVATE_MESSAGE',
            message: `Nuevo mensaje privado de ${message.sender.name}`,
          }
        });
        emitToUser(chatId, 'new-notification', {
          ...notif,
          senderId: userId,
          senderName: message.sender.name || 'Usuario'
        });
      }

      return {
        approved: true,
        savedMessage: message
      };
    } else {
      // 2. PERSIST GROUP MESSAGE
      const group = await prisma.studyGroup.findUnique({
        where: { id: chatId },
        include: { members: true },
      });

      if (!group) {
        return {
          approved: false,
          message: 'Grupo no encontrado',
          handler: 'PersistenciaHandler'
        };
      }

      const isMember = group.members.some((m) => m.id === userId) || group.ownerId === userId;
      if (!isMember) {
        return {
          approved: false,
          message: 'No perteneces a este grupo',
          handler: 'PersistenciaHandler'
        };
      }

      const memberNames = group.members.map(m => m.name || '').filter(Boolean);
      const processedContent = decorateMessage(content, { memberNames });

      const messageWithDecorations = await prisma.$transaction(async (tx) => {
        const createdMessage = await tx.message.create({
          data: {
            content: processedContent,
            senderId: userId,
            groupId: chatId,
            isPrivate: false,
            fileUrl,
            fileName,
            fileType,
          },
        });

        if (poll) {
          await createPollForMessageInTransaction(tx, {
            groupId: chatId,
            messageId: createdMessage.id,
            creatorId: userId,
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

      if (!normalizedMessage) {
        return {
          approved: false,
          message: 'No se pudo crear el mensaje',
          handler: 'PersistenciaHandler'
        };
      }

      // Notify observers (Observer Pattern)
      await chatSubject.notify('NUEVO_MENSAJE', {
        isPrivate: false,
        message: normalizedMessage
      });

      // Notifications logic
      for (const member of group.members) {
        if (String(member.id) !== String(userId)) {
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

      return {
        approved: true,
        savedMessage: normalizedMessage
      };
    }
  }
}
