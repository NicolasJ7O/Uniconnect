import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../errors/app-error.js';
import { RecursoBase } from './decorators/recurso-base.js';
import { RecursoConPreviewOpenGraph } from './decorators/recurso-con-preview-og.js';
import { RecursoConEtiquetas } from './decorators/recurso-con-etiquetas.js';
import { RecursoConEstadisticas } from './decorators/recurso-con-estadisticas.js';
import type { RecursoInfo } from './decorators/recurso-academico.interface.js';
import { extractOpenGraph } from './og-extractor.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResourceType = 'LINK' | 'PDF' | 'VIDEO' | 'DOCUMENTO' | 'OTRO';
export type SortBy = 'recent' | 'popular';

export interface ListResourcesOptions {
  subjectId: string;
  search?: string;
  type?: ResourceType;
  tag?: string;
  sortBy?: SortBy;
  page?: number;
  limit?: number;
}

export interface CreateResourceDto {
  title: string;
  description?: string;
  url?: string;
  type: ResourceType;
  tags?: string[];
  subjectId: string;
  authorId: string;
}

export interface UpdateResourceDto {
  title?: string;
  description?: string;
  url?: string;
  type?: ResourceType;
  tags?: string[];
}

// ─── Internal DB shape helper ─────────────────────────────────────────────────

const resourceInclude = {
  author: { select: { id: true, name: true, avatarUrl: true } },
  openGraph: true,
  tags: { include: { tag: { select: { name: true } } } },
  stats: true,
} as const;

type RawResource = Awaited<ReturnType<typeof prisma.academicResource.findUniqueOrThrow>> & {
  author: { id: string; name: string | null; avatarUrl: string | null };
  openGraph: {
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    ogSiteName: string | null;
  } | null;
  tags: { tag: { name: string } }[];
  stats: { views: number; downloads: number; votes: number } | null;
};

// ─── Decorator assembly ───────────────────────────────────────────────────────

/**
 * Assembles all applicable decorators around a RecursoBase.
 * The order is: Base → OG Preview → Tags → Stats (composable, additive).
 */
export function assembleDecorated(raw: RawResource): RecursoInfo {
  let recurso = new RecursoBase(raw);

  // Decorator 1 – Open Graph preview (only if OG data exists)
  const ogDecorated = new RecursoConPreviewOpenGraph(
    recurso,
    raw.openGraph
      ? {
          ogTitle: raw.openGraph.ogTitle,
          ogDescription: raw.openGraph.ogDescription,
          ogImage: raw.openGraph.ogImage,
          ogSiteName: raw.openGraph.ogSiteName,
        }
      : null,
  );

  // Decorator 2 – Tags
  const tagNames = raw.tags.map((t) => t.tag.name);
  const tagDecorated = new RecursoConEtiquetas(ogDecorated, tagNames);

  // Decorator 3 – Stats
  const statsDecorated = new RecursoConEstadisticas(
    tagDecorated,
    raw.stats
      ? {
          views: raw.stats.views,
          downloads: raw.stats.downloads,
          votes: raw.stats.votes,
        }
      : null,
  );

  return statsDecorated.getInfo();
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function getResources(opts: ListResourcesOptions) {
  const {
    subjectId,
    search,
    type,
    tag,
    sortBy = 'recent',
    page = 1,
    limit = 20,
  } = opts;

  const skip = (page - 1) * limit;

  const where = {
    subjectId,
    isDeleted: false,
    ...(type && { type }),
    ...(search && {
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(tag && {
      tags: { some: { tag: { name: { equals: tag, mode: 'insensitive' as const } } } },
    }),
  };

  const orderBy =
    sortBy === 'popular'
      ? { stats: { votes: 'desc' as const } }
      : { publishedAt: 'desc' as const };

  const [total, rows] = await Promise.all([
    prisma.academicResource.count({ where }),
    prisma.academicResource.findMany({
      where,
      include: resourceInclude,
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  return {
    data: rows.map((r) => assembleDecorated(r as RawResource)),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getResourceById(id: string): Promise<RecursoInfo> {
  const resource = await prisma.academicResource.findUnique({
    where: { id },
    include: resourceInclude,
  });

  if (!resource || resource.isDeleted) {
    throw new AppError(404, 'Recurso no encontrado');
  }

  // Increment view count (fire-and-forget)
  prisma.resourceStats
    .upsert({
      where: { resourceId: id },
      create: { resourceId: id, views: 1 },
      update: { views: { increment: 1 } },
    })
    .catch(() => {});

  return assembleDecorated(resource as RawResource);
}

export async function createResource(dto: CreateResourceDto): Promise<RecursoInfo> {
  const { tags = [], ...rest } = dto;

  return await prisma.$transaction(async (tx) => {
    // Upsert tags
    const tagRecords = await Promise.all(
      tags.map((name) =>
        tx.resourceTag.upsert({
          where: { name: name.toLowerCase().trim() },
          create: { name: name.toLowerCase().trim() },
          update: {},
        }),
      ),
    );

    const resource = await tx.academicResource.create({
      data: {
        title: rest.title,
        description: rest.description,
        url: rest.url,
        type: rest.type,
        authorId: rest.authorId,
        subjectId: rest.subjectId,
        tags: {
          create: tagRecords.map((t) => ({ tagId: t.id })),
        },
        stats: { create: {} },
      },
      include: resourceInclude,
    });

    // Audit log
    await tx.resourceAuditLog.create({
      data: {
        resourceId: resource.id,
        userId: rest.authorId,
        subjectId: rest.subjectId,
        action: 'CREATE',
        metadata: { type: rest.type },
      },
    });

    // Async OG extraction – fire-and-forget, does NOT block the response
    if (rest.type === 'LINK' && rest.url) {
      const resourceId = resource.id;
      const url = rest.url;
      setImmediate(async () => {
        try {
          const og = await extractOpenGraph(url);
          if (og) {
            await prisma.resourceOpenGraph.upsert({
              where: { resourceId },
              create: { resourceId, ...og },
              update: { ...og },
            });
          }
        } catch {
          // Swallow – OG enrichment is best-effort
        }
      });
    }

    return assembleDecorated(resource as RawResource);
  });
}

export async function updateResource(
  id: string,
  authorId: string,
  dto: UpdateResourceDto,
): Promise<RecursoInfo> {
  const { tags, ...rest } = dto;

  return await prisma.$transaction(async (tx) => {
    // Handle tag replacement
    if (tags !== undefined) {
      await tx.resourceTagMap.deleteMany({ where: { resourceId: id } });

      const tagRecords = await Promise.all(
        tags.map((name) =>
          tx.resourceTag.upsert({
            where: { name: name.toLowerCase().trim() },
            create: { name: name.toLowerCase().trim() },
            update: {},
          }),
        ),
      );

      await tx.resourceTagMap.createMany({
        data: tagRecords.map((t) => ({ resourceId: id, tagId: t.id })),
        skipDuplicates: true,
      });
    }

    const updated = await tx.academicResource.update({
      where: { id },
      data: { ...rest, updatedAt: new Date() },
      include: resourceInclude,
    });

    await tx.resourceAuditLog.create({
      data: {
        resourceId: id,
        userId: authorId,
        subjectId: updated.subjectId,
        action: 'UPDATE',
        metadata: { changes: Object.keys(dto) },
      },
    });

    // Re-extract OG if URL changed
    if (rest.url && updated.type === 'LINK') {
      const resourceId = id;
      const url = rest.url;
      setImmediate(async () => {
        try {
          const og = await extractOpenGraph(url);
          if (og) {
            await prisma.resourceOpenGraph.upsert({
              where: { resourceId },
              create: { resourceId, ...og },
              update: { ...og },
            });
          }
        } catch {}
      });
    }

    return assembleDecorated(updated as RawResource);
  });
}

export async function deleteResource(id: string, userId: string): Promise<void> {
  const resource = await prisma.academicResource.findUnique({
    where: { id },
    select: { subjectId: true },
  });

  if (!resource) throw new AppError(404, 'Recurso no encontrado');

  await prisma.$transaction([
    prisma.academicResource.update({
      where: { id },
      data: { isDeleted: true },
    }),
    prisma.resourceAuditLog.create({
      data: {
        resourceId: id,
        userId,
        subjectId: resource.subjectId,
        action: 'DELETE',
      },
    }),
  ]);
}

export async function voteResource(
  resourceId: string,
  userId: string,
  value: 1 | -1,
): Promise<RecursoInfo> {
  const resource = await prisma.academicResource.findUnique({
    where: { id: resourceId },
    select: { subjectId: true, isDeleted: true },
  });

  if (!resource || resource.isDeleted) throw new AppError(404, 'Recurso no encontrado');

  await prisma.$transaction([
    prisma.resourceStats.upsert({
      where: { resourceId },
      create: { resourceId, votes: value === 1 ? 1 : 0 },
      update: { votes: { increment: value } },
    }),
    prisma.resourceAuditLog.create({
      data: {
        resourceId,
        userId,
        subjectId: resource.subjectId,
        action: 'VOTE',
        metadata: { value },
      },
    }),
  ]);

  return getResourceById(resourceId);
}
