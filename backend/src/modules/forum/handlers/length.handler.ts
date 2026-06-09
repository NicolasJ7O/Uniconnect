import { ForumHandler, ForumRequestContext } from './forum-handler.js';
import { AppError } from '../../../errors/app-error.js';

export class LengthHandler extends ForumHandler {
  protected async process(context: ForumRequestContext): Promise<void> {
    const { action, data } = context;

    if (action === 'CREATE_QUESTION' || action === 'UPDATE_QUESTION') {
      const titleLen = (data.title || '').trim().length;
      const contentLen = (data.content || '').trim().length;

      if (titleLen < 5 || titleLen > 100) {
        throw new AppError(400, 'El título de la pregunta debe tener entre 5 y 100 caracteres');
      }

      if (contentLen < 10 || contentLen > 2000) {
        throw new AppError(400, 'El contenido de la pregunta debe tener entre 10 y 2000 caracteres');
      }
    } else if (action === 'CREATE_ANSWER') {
      const contentLen = (data.content || '').trim().length;

      if (contentLen < 5 || contentLen > 2000) {
        throw new AppError(400, 'El contenido de la respuesta debe tener entre 5 y 2000 caracteres');
      }
    }
  }
}
