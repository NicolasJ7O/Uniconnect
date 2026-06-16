import { ModerationHandler, ModerationContext, ModerationResult, logModerationRejection } from './moderation.handler.js';
import { moderationConfig } from '../../../config/moderation.config.js';

export class EnlacesExternosHandler extends ModerationHandler {
  protected async process(ctx: ModerationContext): Promise<ModerationResult> {
    if (!ctx.content) {
      return { approved: true };
    }

    // Find URLs and extract domains
    const urlRegex = /https?:\/\/(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/gi;
    let match;
    const unallowedDomains: string[] = [];

    while ((match = urlRegex.exec(ctx.content)) !== null) {
      const domain = match[1].toLowerCase();
      
      const isAllowed = moderationConfig.dominiosPermitidos.some((allowed) => {
        return domain === allowed || domain.endsWith('.' + allowed);
      });

      if (!isAllowed) {
        unallowedDomains.push(domain);
      }
    }

    if (unallowedDomains.length > 0) {
      await logModerationRejection({
        userId: ctx.userId,
        handler: 'EnlacesExternosHandler',
        moderationCode: 'MO_004',
        chatId: ctx.chatId,
        content: ctx.content,
        metadata: {
          detectedDomains: unallowedDomains,
          ip: ctx.ip
        }
      });

      return {
        approved: false,
        moderationCode: 'MO_004',
        message: `Enlaces externos no permitidos detectados: ${unallowedDomains.join(', ')}`,
        handler: 'EnlacesExternosHandler'
      };
    }

    return { approved: true };
  }
}
