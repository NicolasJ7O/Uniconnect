import { AppError } from '../../../errors/app-error.js';

export type LibraryAction = 'VIEW' | 'PUBLISH' | 'EDIT' | 'DELETE' | 'MODERATE';

export interface LibraryRequestContext {
  userId: string;
  subjectId: string;
  action: LibraryAction;
  resourceId?: string;
  resourceAuthorId?: string; // populated by ownership handler lookup
}

/**
 * Abstract base handler for the Library Chain of Responsibility.
 * Each concrete handler calls process() then delegates to the next handler.
 */
export abstract class LibraryHandler {
  private next?: LibraryHandler;

  public setNext(handler: LibraryHandler): LibraryHandler {
    this.next = handler;
    return handler;
  }

  public async handle(ctx: LibraryRequestContext): Promise<void> {
    await this.process(ctx);
    if (this.next) {
      await this.next.handle(ctx);
    }
  }

  protected abstract process(ctx: LibraryRequestContext): Promise<void>;
}
