import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware.js';
import { requireRoles } from '../auth/role.middleware.js';
import {
  createAdminEventCategoryHandler,
  deleteAdminEventCategoryHandler,
  listAdminEventCategoriesHandler,
  updateAdminEventCategoryHandler,
} from './event-category.controller.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRoles('super_admin', 'admin'));

adminRouter.get('/health', (_req, res) => {
  res.json({ ok: true, scope: 'admin' });
});

adminRouter.get('/categories', listAdminEventCategoriesHandler);
adminRouter.post('/categories', createAdminEventCategoryHandler);
adminRouter.patch('/categories/:id', updateAdminEventCategoryHandler);
adminRouter.delete('/categories/:id', deleteAdminEventCategoryHandler);
