import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { assistantController } from './assistant.controller.js';
import { assistantFeedbackController } from './assistant-feedback.controller.js';

export const assistantRouter = Router();

assistantRouter.use(requireAuth);

assistantRouter.get('/session/:sessionKey', assistantController.getSession);
assistantRouter.post('/session/:sessionKey/messages', assistantController.sendMessage);
assistantRouter.post('/feedback', assistantFeedbackController.submit);
assistantRouter.get('/feedback/report', assistantFeedbackController.report);
assistantRouter.get('/feedback/export.csv', assistantFeedbackController.exportCsv);
