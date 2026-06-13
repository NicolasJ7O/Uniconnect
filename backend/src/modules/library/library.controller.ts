import type { Request, Response } from 'express';
import { catchAsync } from '../../lib/catch-async.js';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import {
  getResources,
  getResourceById,
  createResource,
  updateResource,
  deleteResource,
  voteResource,
  type ResourceType,
  type SortBy,
} from './library.service.js';
import type { LibraryRequestContext } from './handlers/library-handler.js';
import { LibraryAuthHandler } from './handlers/auth.handler.js';
import { LibraryEnrollmentHandler } from './handlers/enrollment.handler.js';
import { LibraryRolePermissionHandler } from './handlers/role-permission.handler.js';
import { LibraryOwnershipHandler } from './handlers/ownership.handler.js';

// ─── CoR factory ─────────────────────────────────────────────────────────────

async function runLibraryCoR(ctx: LibraryRequestContext): Promise<void> {
  const auth = new LibraryAuthHandler();
  const enrollment = new LibraryEnrollmentHandler();
  const role = new LibraryRolePermissionHandler();
  const ownership = new LibraryOwnershipHandler();
  auth.setNext(enrollment).setNext(role).setNext(ownership);
  await auth.handle(ctx);
}

// ─── DB user ID resolver (same pattern as forum.controller) ──────────────────

async function resolveDbUserId(userId: string, email?: string): Promise<string> {
  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) return user.id;
  }
  return userId;
}

// ─── Handlers ────────────────────────────────────────────────────────────────

export const listResourcesHandler = catchAsync(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const { search, type, tag, sortBy, page, limit } = req.query as Record<string, string>;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  await runLibraryCoR({ userId, subjectId, action: 'VIEW' });

  const result = await getResources({
    subjectId,
    search,
    type: type as ResourceType | undefined,
    tag,
    sortBy: sortBy as SortBy | undefined,
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? Math.min(parseInt(limit, 10), 50) : 20,
  });

  res.json(result);
});

export const getResourceHandler = catchAsync(async (req: Request, res: Response) => {
  const { resourceId } = req.params;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  // Resolve subjectId from resource to validate enrollment
  const resource = await prisma.academicResource.findUnique({
    where: { id: resourceId },
    select: { subjectId: true, isDeleted: true },
  });
  if (!resource || resource.isDeleted) throw new AppError(404, 'Recurso no encontrado');

  await runLibraryCoR({ userId, subjectId: resource.subjectId, action: 'VIEW' });

  const result = await getResourceById(resourceId);
  res.json(result);
});

export const createResourceHandler = catchAsync(async (req: Request, res: Response) => {
  const { subjectId } = req.params;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  await runLibraryCoR({ userId, subjectId, action: 'PUBLISH' });

  let { title, description, url, type, tags, categories } = req.body;
  const reqAny = req as any;

  if (reqAny.file) {
    url = `/uploads/groups/${reqAny.file.filename}`;
  }

  // Si tags viene como un string (desde formdata separadas por como), se convierte a array
  let parsedTags: string[] = [];
  if (typeof tags === 'string') {
    parsedTags = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
  } else if (Array.isArray(tags)) {
    parsedTags = tags;
  }

  let parsedCategories: string[] = [];
  if (typeof categories === 'string') {
    parsedCategories = categories.split(',').map((item: string) => item.trim()).filter(Boolean);
  } else if (Array.isArray(categories)) {
    parsedCategories = categories;
  }

  if (!title?.trim()) throw new AppError(400, 'El título es requerido');
  if (!type) throw new AppError(400, 'El tipo de recurso es requerido');
  if (['PDF', 'VIDEO', 'DOCUMENTO', 'IMAGE'].includes(type) && !reqAny.file && !String(url ?? '').trim()) {
    throw new AppError(400, 'Debes adjuntar un archivo o un enlace para este tipo de recurso');
  }

  const result = await createResource({
    title,
    description,
    url,
    type,
    tags: parsedTags,
    categories: parsedCategories,
    subjectId,
    authorId: userId,
  });

  res.status(201).json(result);
});

export const updateResourceHandler = catchAsync(async (req: Request, res: Response) => {
  const { resourceId } = req.params;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  const resource = await prisma.academicResource.findUnique({
    where: { id: resourceId },
    select: { subjectId: true, isDeleted: true },
  });
  if (!resource || resource.isDeleted) throw new AppError(404, 'Recurso no encontrado');

  await runLibraryCoR({ userId, subjectId: resource.subjectId, action: 'EDIT', resourceId });

  const result = await updateResource(resourceId, userId, req.body);
  res.json(result);
});

export const deleteResourceHandler = catchAsync(async (req: Request, res: Response) => {
  const { resourceId } = req.params;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  const resource = await prisma.academicResource.findUnique({
    where: { id: resourceId },
    select: { subjectId: true, isDeleted: true },
  });
  if (!resource || resource.isDeleted) throw new AppError(404, 'Recurso no encontrado');

  await runLibraryCoR({ userId, subjectId: resource.subjectId, action: 'DELETE', resourceId });

  await deleteResource(resourceId, userId);
  res.status(204).send();
});

export const voteResourceHandler = catchAsync(async (req: Request, res: Response) => {
  const { resourceId } = req.params;
  const { value } = req.body;
  const payload = req.user!;
  const userId = await resolveDbUserId(payload.sub, payload.email);

  if (value !== 1 && value !== -1) throw new AppError(400, 'El valor del voto debe ser 1 o -1');

  const resource = await prisma.academicResource.findUnique({
    where: { id: resourceId },
    select: { subjectId: true, isDeleted: true },
  });
  if (!resource || resource.isDeleted) throw new AppError(404, 'Recurso no encontrado');

  await runLibraryCoR({ userId, subjectId: resource.subjectId, action: 'PUBLISH' });

  const result = await voteResource(resourceId, userId, value as 1 | -1);
  res.json(result);
});
