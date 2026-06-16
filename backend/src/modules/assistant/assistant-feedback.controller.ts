import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../errors/app-error.js';
import { exportAssistantFeedbackCsv, getAssistantFeedbackReport, submitAssistantFeedback } from './assistant-feedback.service.js';

export class AssistantFeedbackController {
  async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.sub;
      if (!userId) return res.status(401).json({ message: 'No autenticado' });

      const result = await submitAssistantFeedback({
        userId,
        assistantMessageId: req.body?.assistantMessageId,
        sessionId: req.body?.sessionId,
        question: req.body?.question,
        answer: req.body?.answer,
        rating: req.body?.rating,
        comment: req.body?.comment,
        chunks: req.body?.chunks ?? req.body?.contextChunks,
        metadata: {
          role: req.user?.role,
          submittedAt: new Date().toISOString(),
        },
      });

      return res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async report(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.role || !['super_admin', 'admin'].includes(req.user.role)) {
        throw new AppError(403, 'Solo un super administrador puede ver el feedback');
      }

      const report = await getAssistantFeedbackReport({
        page: Number(req.query.page ?? 1),
        pageSize: Number(req.query.pageSize ?? 10),
        rating: String(req.query.rating ?? 'NOT_USEFUL'),
        startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
        endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
        role: typeof req.query.role === 'string' ? req.query.role : undefined,
        minFrequency: typeof req.query.minFrequency === 'string' ? Number(req.query.minFrequency) : undefined,
      });

      return res.json(report);
    } catch (error) {
      next(error);
    }
  }

  async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user?.role || !['super_admin', 'admin'].includes(req.user.role)) {
        throw new AppError(403, 'Solo un super administrador puede exportar el feedback');
      }

      const csv = await exportAssistantFeedbackCsv();
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="assistant-feedback.csv"');
      return res.send(csv);
    } catch (error) {
      next(error);
    }
  }
}

export const assistantFeedbackController = new AssistantFeedbackController();
