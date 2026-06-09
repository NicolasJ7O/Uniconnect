import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import {
  listResourcesHandler,
  getResourceHandler,
  createResourceHandler,
  updateResourceHandler,
  deleteResourceHandler,
  voteResourceHandler,
} from './library.controller.js';

export const libraryRouter = Router();

libraryRouter.use(requireAuth);

// List / create resources for a subject
libraryRouter.get('/subjects/:subjectId/resources', listResourcesHandler);
libraryRouter.post('/subjects/:subjectId/resources', createResourceHandler);

// Individual resource operations
libraryRouter.get('/resources/:resourceId', getResourceHandler);
libraryRouter.patch('/resources/:resourceId', updateResourceHandler);
libraryRouter.delete('/resources/:resourceId', deleteResourceHandler);

// Voting
libraryRouter.post('/resources/:resourceId/vote', voteResourceHandler);
