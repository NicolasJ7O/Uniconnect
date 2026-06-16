import type { Request, Response } from 'express';
import { catchAsync } from '../../lib/catch-async.js';
import { AppError } from '../../errors/app-error.js';
import { createEventCategory, deleteEventCategory, listEventCategories, updateEventCategory } from './event-category.service.js';

export const listAdminEventCategoriesHandler = catchAsync(async (req: Request, res: Response) => {
  if (!['super_admin', 'admin'].includes(req.user?.role ?? '')) throw new AppError(403, 'Acceso restringido a administradores');

  const result = await listEventCategories({
    page: Number(req.query.page ?? 1),
    pageSize: Number(req.query.pageSize ?? 10),
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
  });

  res.json(result);
});

export const createAdminEventCategoryHandler = catchAsync(async (req: Request, res: Response) => {
  if (!['super_admin', 'admin'].includes(req.user?.role ?? '')) throw new AppError(403, 'Acceso restringido a administradores');

  const category = await createEventCategory({
    name: req.body?.name,
    description: req.body?.description,
  });

  res.status(201).json({ id: category.id, nombre: category.name, slug: category.slug, description: category.description });
});

export const updateAdminEventCategoryHandler = catchAsync(async (req: Request, res: Response) => {
  if (!['super_admin', 'admin'].includes(req.user?.role ?? '')) throw new AppError(403, 'Acceso restringido a administradores');

  const category = await updateEventCategory(req.params.id, {
    name: req.body?.name,
    description: req.body?.description,
  });

  res.json({ id: category.id, nombre: category.name, slug: category.slug, description: category.description });
});

export const deleteAdminEventCategoryHandler = catchAsync(async (req: Request, res: Response) => {
  if (!['super_admin', 'admin'].includes(req.user?.role ?? '')) throw new AppError(403, 'Acceso restringido a administradores');

  const result = await deleteEventCategory(req.params.id);
  res.json(result);
});
