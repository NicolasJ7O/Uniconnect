import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  getQuestionsHandler,
  getQuestionThreadHandler,
  createQuestionHandler,
  createAnswerHandler,
  voteQuestionHandler,
  voteAnswerHandler,
  acceptAnswerHandler,
  getHistoryHandler
} from './forum.controller.js';

export const forumRouter = Router();

// Require valid authentication for all forum routes
forumRouter.use(requireAuth);

forumRouter.get('/subjects/:subjectId/questions', getQuestionsHandler);
forumRouter.get('/questions/:questionId', getQuestionThreadHandler);
forumRouter.post('/subjects/:subjectId/questions', createQuestionHandler);
forumRouter.post('/questions/:questionId/answers', createAnswerHandler);
forumRouter.post('/questions/:questionId/vote', voteQuestionHandler);
forumRouter.post('/answers/:answerId/vote', voteAnswerHandler);
forumRouter.post('/answers/:answerId/accept', acceptAnswerHandler);
forumRouter.get('/subjects/:subjectId/history', getHistoryHandler);
