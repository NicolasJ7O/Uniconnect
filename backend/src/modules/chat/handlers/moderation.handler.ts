import { prisma } from '../../../lib/prisma.js';

export interface ModerationContext {
  userId: string;
  content: string;
  chatId: string; // groupId for group chat, receiverId for private chat
  isPrivate: boolean;
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
}

export interface ModerationResult {
  approved: boolean;
  moderationCode?: string;
  message?: string;
  handler?: string;
  savedMessage?: any;
  blockedUntil?: Date;
}

export abstract class ModerationHandler {
  protected nextHandler?: ModerationHandler;

  public setNext(handler: ModerationHandler): ModerationHandler {
    this.nextHandler = handler;
    return handler;
  }

  public async handle(ctx: ModerationContext): Promise<ModerationResult> {
    const result = await this.process(ctx);
    if (!result.approved) {
      return result;
    }
    if (this.nextHandler) {
      return this.nextHandler.handle(ctx);
    }
    return result;
  }

  protected abstract process(ctx: ModerationContext): Promise<ModerationResult>;
}

export function anonymizeMessage(content: string): string {
  if (!content) return '';
  if (content.length <= 6) {
    return '***';
  }
  return content.slice(0, 3) + '...' + content.slice(-3);
}

export async function logModerationRejection(params: {
  userId: string;
  handler: string;
  moderationCode: string;
  chatId: string;
  content: string;
  metadata?: any;
}) {
  try {
    await prisma.moderationAuditLog.create({
      data: {
        userId: params.userId,
        handler: params.handler,
        moderationCode: params.moderationCode,
        chatId: params.chatId,
        messageSnippet: anonymizeMessage(params.content),
        metadata: params.metadata || {},
      },
    });
  } catch (error) {
    console.error('Error logging moderation rejection:', error);
  }
}

