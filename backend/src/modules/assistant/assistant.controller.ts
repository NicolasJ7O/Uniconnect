import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { getAssistantSessionHistory, sendAssistantMessage } from './assistant.service.js';

export class AssistantController {
  async getSession(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.sub;
      const role = req.user?.role;
      const { sessionKey } = req.params;

      if (!userId) return res.status(401).json({ message: 'No autenticado' });
      if (!sessionKey) throw new AppError(400, 'La sesión del asistente es obligatoria');

      const session = await getAssistantSessionHistory(userId, sessionKey, role || 'student');
      return res.json(session);
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.sub;
      const role = req.user?.role;
      const { sessionKey } = req.params;
      const message = [req.body?.message, req.body?.content, req.body?.query]
        .find((value): value is string => typeof value === 'string') ?? '';

      if (!userId) return res.status(401).json({ message: 'No autenticado' });
      if (!sessionKey) throw new AppError(400, 'La sesión del asistente es obligatoria');

      const result = await sendAssistantMessage(userId, sessionKey, role || 'student', message);
      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const assistantController = new AssistantController();
