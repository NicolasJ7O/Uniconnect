import { ForumHandler, ForumRequestContext } from './forum-handler.js';
import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../errors/app-error.js';

export class EnrollmentHandler extends ForumHandler {
  protected async process(context: ForumRequestContext): Promise<void> {
    if (!context.subjectId) {
      throw new AppError(400, 'ID de asignatura no provisto');
    }

    const enrolled = await prisma.subject.count({
      where: {
        id: context.subjectId,
        students: {
          some: { id: context.userId },
        },
      },
    });

    if (enrolled === 0) {
      throw new AppError(403, 'Acción denegada: El estudiante no está matriculado en esta asignatura');
    }
  }
}
