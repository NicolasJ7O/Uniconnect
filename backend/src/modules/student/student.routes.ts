import { Router } from 'express';
import { getProfileHandler, updateProfileHandler, getSubjectsHandler, searchStudentsHandler, getProfileByIdHandler } from './student.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const studentRouter = Router();

// Require valid JWT authentication for all student routes
studentRouter.use(requireAuth);

studentRouter.get('/profile', getProfileHandler);
studentRouter.put('/profile', updateProfileHandler);
studentRouter.get('/subjects', getSubjectsHandler);
studentRouter.get('/search', searchStudentsHandler);
studentRouter.get('/perfil/:id', getProfileByIdHandler);
