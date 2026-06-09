import { LibraryHandler, type LibraryRequestContext } from './library-handler.js';
import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../errors/app-error.js';

/** Validates that the requesting user exists and is active. */
export class LibraryAuthHandler extends LibraryHandler {
  protected async process(ctx: LibraryRequestContext): Promise<void> {
    if (!ctx.userId) throw new AppError(401, 'Usuario no autenticado');

    const user = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { isActive: true },
    });

    if (!user) throw new AppError(401, 'Usuario no encontrado');
    if (!user.isActive) throw new AppError(401, 'El usuario se encuentra inactivo');
  }
}
