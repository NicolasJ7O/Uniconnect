import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { Logger } from '../../lib/logger.js';

const logger = Logger.getInstance();

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

export async function listEventCategories(input: { page?: number; pageSize?: number; search?: string }) {
  const page = Math.max(1, Number(input.page ?? 1));
  const pageSize = Math.max(1, Math.min(100, Number(input.pageSize ?? 10)));
  const search = input.search?.trim();

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { slug: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  const [items, total] = await Promise.all([
    prisma.eventCategory.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.eventCategory.count({ where }),
  ]);

  const enriched = await Promise.all(
    items.map(async (category) => ({
      ...category,
      eventCount: await prisma.event.count({ where: { categoryId: category.id } }),
    }))
  );

  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    items: enriched,
  };
}

export async function createEventCategory(input: { name: string; description?: string }) {
  const name = input.name.trim();
  if (!name) throw new AppError(400, 'El nombre de la categoría es obligatorio');

  const existing = await prisma.eventCategory.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });

  if (existing) {
    throw new AppError(409, `La categoría "${existing.name}" ya existe y genera la colisión`);
  }

  const category = await prisma.eventCategory.create({
    data: {
      name,
      slug: slugify(name),
      description: input.description?.trim() || null,
    },
  });

  logger.info('Categoría de evento creada por administrador', { categoryId: category.id, name: category.name, slug: category.slug });
  return category;
}

export async function updateEventCategory(id: string, input: { name?: string; description?: string }) {
  const existing = await prisma.eventCategory.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'Categoría no encontrada');

  const nextName = input.name?.trim();
  if (nextName) {
    const duplicate = await prisma.eventCategory.findFirst({
      where: {
        id: { not: id },
        name: { equals: nextName, mode: 'insensitive' },
      },
    });

    if (duplicate) {
      throw new AppError(409, `La categoría "${duplicate.name}" ya existe y genera la colisión`);
    }
  }

  const category = await prisma.eventCategory.update({
    where: { id },
    data: {
      name: nextName ?? existing.name,
      slug: nextName ? slugify(nextName) : existing.slug,
      description: input.description !== undefined ? (input.description.trim() || null) : existing.description,
    },
  });

  logger.info('Categoría de evento actualizada por administrador', { categoryId: category.id, name: category.name, slug: category.slug });
  return category;
}

export async function deleteEventCategory(id: string) {
  const category = await prisma.eventCategory.findUnique({ where: { id } });
  if (!category) throw new AppError(404, 'Categoría no encontrada');

  const eventCount = await prisma.event.count({ where: { categoryId: id } });
  if (eventCount > 0) {
    throw new AppError(409, `No se puede eliminar la categoría porque tiene ${eventCount} evento(s) asociado(s)`);
  }

  await prisma.eventCategory.delete({ where: { id } });
  logger.warn('Categoría de evento eliminada por administrador', { categoryId: id, name: category.name });
  return { deleted: true, categoryId: id };
}
