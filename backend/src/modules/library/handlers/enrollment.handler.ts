import { LibraryHandler, type LibraryRequestContext } from './library-handler.js';
import { prisma } from '../../../lib/prisma.js';
import { AppError } from '../../../errors/app-error.js';

/** Validates the user is enrolled in the target subject. */
export class LibraryEnrollmentHandler extends LibraryHandler {
  protected async process(ctx: LibraryRequestContext): Promise<void> {
    if (!ctx.subjectId) throw new AppError(400, 'ID de asignatura no provisto');

    const count = await prisma.subject.count({
      where: {
        id: ctx.subjectId,
        students: { some: { id: ctx.userId } },
      },
    });

    if (count === 0) {
      throw new AppError(403, 'Acceso denegado: no estás matriculado en esta asignatura');
    }
  }
}
