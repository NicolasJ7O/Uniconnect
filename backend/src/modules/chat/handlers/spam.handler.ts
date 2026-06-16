import { prisma } from '../../../lib/prisma.js';
import { ModerationHandler, ModerationContext, ModerationResult, logModerationRejection } from './moderation.handler.js';

export class SpamHandler extends ModerationHandler {
  protected async process(ctx: ModerationContext): Promise<ModerationResult> {
    const { userId, chatId, content, ip } = ctx;

    // 1. Check if user has an active block in the database
    const activeBlock = await prisma.userBlock.findUnique({
      where: { userId }
    });

    if (activeBlock) {
      if (activeBlock.blockedUntil > new Date()) {
        await logModerationRejection({
          userId,
          handler: 'SpamHandler',
          moderationCode: 'MO_003',
          chatId,
          content,
          metadata: {
            blockedUntil: activeBlock.blockedUntil,
            reason: activeBlock.reason,
            ip
          }
        });

        return {
          approved: false,
          moderationCode: 'MO_003',
          message: 'Usuario bloqueado temporalmente por spam',
          handler: 'SpamHandler'
        };
      } else {
        // Clean up expired block
        await prisma.userBlock.delete({
          where: { userId }
        }).catch(() => {});
      }
    }

    // 2. Count messages sent in the last 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
    const count = await prisma.message.count({
      where: {
        senderId: userId,
        createdAt: { gte: thirtySecondsAgo }
      }
    });

    if (count >= 5) {
      const blockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes block
      
      await prisma.userBlock.upsert({
        where: { userId },
        update: { blockedUntil, reason: 'Spam detection (exceeded limit)' },
        create: { userId, blockedUntil, reason: 'Spam detection (exceeded limit)' }
      });

      await logModerationRejection({
        userId,
        handler: 'SpamHandler',
        moderationCode: 'MO_003',
        chatId,
        content,
        metadata: {
          blockedUntil,
          count,
          ip
        }
      });

      return {
        approved: false,
        moderationCode: 'MO_003',
        message: 'Usuario bloqueado temporalmente por spam (5 minutos)',
        handler: 'SpamHandler'
      };
    }

    return { approved: true };
  }
}
