import { ForumHandler, ForumRequestContext } from './forum-handler.js';
import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../errors/app-error.js';

export class AuthHandler extends ForumHandler {
  protected async process(context: ForumRequestContext): Promise<void> {
    if (!context.userId) {
      throw new AppError(401, 'Usuario no autenticado');
    }

    const user = await prisma.user.findUnique({
      where: { id: context.userId },
      select: { isActive: true },
    });

    if (!user) {
      throw new AppError(401, 'Usuario no encontrado');
    }

    if (!user.isActive) {
      throw new AppError(401, 'El usuario se encuentra inactivo');
    }
  }
}
