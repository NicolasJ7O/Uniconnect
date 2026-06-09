import { LibraryHandler, type LibraryRequestContext } from './library-handler.js';
import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../errors/app-error.js';

/**
 * Verifies resource ownership for EDIT/DELETE actions.
 * Only executed when ctx.resourceId is present (moderators clear it upstream).
 */
export class LibraryOwnershipHandler extends LibraryHandler {
  protected async process(ctx: LibraryRequestContext): Promise<void> {
    if (ctx.action !== 'EDIT' && ctx.action !== 'DELETE') return;
    if (!ctx.resourceId) return; // moderator bypass

    const resource = await prisma.academicResource.findUnique({
      where: { id: ctx.resourceId },
      select: { authorId: true, isDeleted: true },
    });

    if (!resource || resource.isDeleted) {
      throw new AppError(404, 'Recurso no encontrado');
    }

    if (resource.authorId !== ctx.userId) {
      throw new AppError(403, 'Acción denegada: solo el autor puede modificar este recurso');
    }
  }
}
