import { AppError } from '../../../errors/app-error.js';

export interface ForumRequestContext {
  userId: string;
  subjectId: string;
  action: 'CREATE_QUESTION' | 'UPDATE_QUESTION' | 'CREATE_ANSWER' | 'VOTE_QUESTION' | 'VOTE_ANSWER' | 'ACCEPT_ANSWER' | 'VIEW_FORUM';
  data: {
    title?: string;
    content?: string;
    value?: number; // for voting
    questionId?: string;
    answerId?: string;
  };
}

export abstract class ForumHandler {
  private nextHandler?: ForumHandler;

  public setNext(handler: ForumHandler): ForumHandler {
    this.nextHandler = handler;
    return handler;
  }

  public async handle(context: ForumRequestContext): Promise<void> {
    await this.process(context);
    if (this.nextHandler) {
      await this.nextHandler.handle(context);
    }
  }

  protected abstract process(context: ForumRequestContext): Promise<void>;
}
