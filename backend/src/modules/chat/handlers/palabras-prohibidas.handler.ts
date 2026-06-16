import { ModerationHandler, ModerationContext, ModerationResult, logModerationRejection } from './moderation.handler.js';
import { moderationConfig } from '../../../config/moderation.config.js';

export class PalabrasProhibidasHandler extends ModerationHandler {
  protected async process(ctx: ModerationContext): Promise<ModerationResult> {
    if (!ctx.content) {
      return { approved: true };
    }

    const text = ctx.content.toLowerCase();
    
    for (const palabra of moderationConfig.palabrasProhibidas) {
      const lowerPalabra = palabra.toLowerCase();
      if (text.includes(lowerPalabra)) {
        await logModerationRejection({
          userId: ctx.userId,
          handler: 'PalabrasProhibidasHandler',
          moderationCode: 'MO_002',
          chatId: ctx.chatId,
          content: ctx.content,
          metadata: {
            termDetected: palabra,
            ip: ctx.ip
          }
        });

        return {
          approved: false,
          moderationCode: 'MO_002',
          message: 'El mensaje contiene palabras inapropiadas',
          handler: 'PalabrasProhibidasHandler'
        };
      }
    }

    return { approved: true };
  }
}
