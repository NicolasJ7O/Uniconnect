import { ModerationHandler, ModerationContext, ModerationResult, logModerationRejection } from './moderation.handler.js';

export class LongitudHandler extends ModerationHandler {
  protected async process(ctx: ModerationContext): Promise<ModerationResult> {
    if (ctx.content && ctx.content.length > 1000) {
      await logModerationRejection({
        userId: ctx.userId,
        handler: 'LongitudHandler',
        moderationCode: 'MO_001',
        chatId: ctx.chatId,
        content: ctx.content,
        metadata: {
          length: ctx.content.length,
          ip: ctx.ip
        }
      });

      return {
        approved: false,
        moderationCode: 'MO_001',
        message: 'Mensaje demasiado largo',
        handler: 'LongitudHandler'
      };
    }

    return { approved: true };
  }
}
