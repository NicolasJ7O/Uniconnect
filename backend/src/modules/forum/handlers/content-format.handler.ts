import { ForumHandler, ForumRequestContext } from './forum-handler.js';
import { AppError } from '../../../errors/app-error.js';

export class ContentFormatHandler extends ForumHandler {
  protected async process(context: ForumRequestContext): Promise<void> {
    const { action, data } = context;

    if (action === 'CREATE_QUESTION' || action === 'UPDATE_QUESTION') {
      if (typeof data.title !== 'string' || data.title.trim().length === 0) {
        throw new AppError(400, 'El título de la pregunta es requerido y debe ser un texto válido');
      }
      if (typeof data.content !== 'string' || data.content.trim().length === 0) {
        throw new AppError(400, 'El contenido de la pregunta es requerido y debe ser un texto válido');
      }
    } else if (action === 'CREATE_ANSWER') {
      if (typeof data.content !== 'string' || data.content.trim().length === 0) {
        throw new AppError(400, 'El contenido de la respuesta es requerido y debe ser un texto válido');
      }
    } else if (action === 'VOTE_QUESTION') {
      if (!data.questionId) {
        throw new AppError(400, 'El ID de la pregunta a votar es requerido');
      }
      if (data.value !== 1 && data.value !== -1) {
        throw new AppError(400, 'El valor del voto debe ser 1 o -1');
      }
    } else if (action === 'VOTE_ANSWER') {
      if (!data.answerId) {
        throw new AppError(400, 'El ID de la respuesta a votar es requerido');
      }
      if (data.value !== 1 && data.value !== -1) {
        throw new AppError(400, 'El valor del voto debe ser 1 o -1');
      }
    } else if (action === 'ACCEPT_ANSWER') {
      if (!data.answerId) {
        throw new AppError(400, 'El ID de la respuesta a aceptar es requerido');
      }
    }
  }
}
