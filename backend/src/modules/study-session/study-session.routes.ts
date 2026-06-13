import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  cancelStudySessionHandler,
  cancelStudySessionSeriesHandler,
  createStudySessionHandler,
  getStudySessionByIdHandler,
  getStudySessionsHandler,
  updateStudySessionHandler,
  updateStudySessionSeriesHandler,
} from './study-session.controller.js';

export const studySessionRouter = Router();

studySessionRouter.use(requireAuth);

studySessionRouter.get('/', getStudySessionsHandler);
studySessionRouter.post('/', createStudySessionHandler);
studySessionRouter.put('/series/:id', updateStudySessionSeriesHandler);
studySessionRouter.delete('/series/:id', cancelStudySessionSeriesHandler);
studySessionRouter.get('/:id', getStudySessionByIdHandler);
studySessionRouter.put('/:id', updateStudySessionHandler);
studySessionRouter.delete('/:id', cancelStudySessionHandler);
