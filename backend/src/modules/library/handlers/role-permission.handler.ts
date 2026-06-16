import { LibraryHandler, type LibraryRequestContext } from './library-handler.js';
import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../errors/app-error.js';

/**
 * Maps each action to its minimum required role.
 * VIEW / PUBLISH → any enrolled student (already guaranteed by EnrollmentHandler).
 * EDIT / DELETE  → author or moderator.
 * MODERATE       → moderator role only.
 */
export class LibraryRolePermissionHandler extends LibraryHandler {
  protected async process(ctx: LibraryRequestContext): Promise<void> {
    if (ctx.action === 'VIEW' || ctx.action === 'PUBLISH') {
      // Enrollment handler already guarantees access; nothing extra needed.
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { role: true },
    });

    if (!user) throw new AppError(401, 'Usuario no encontrado');

    const normalizedRole = (user.role || '').toLowerCase();
    const isModerator = normalizedRole === 'moderator' || normalizedRole === 'moderador';

    if (ctx.action === 'MODERATE' && !isModerator) {
      throw new AppError(403, 'Acción denegada: se requiere rol de moderador');
    }

    // For EDIT / DELETE: moderators bypass ownership check; others go to OwnershipHandler
    if ((ctx.action === 'EDIT' || ctx.action === 'DELETE') && isModerator) {
      // Moderators can act on any resource – skip ownership check by clearing resourceId
      ctx.resourceId = undefined;
    }
  }
}
