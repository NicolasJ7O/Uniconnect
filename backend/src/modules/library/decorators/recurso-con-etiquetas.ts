import type { RecursoAcademico, RecursoInfo } from './recurso-academico.interface.js';

/**
 * RecursoConEtiquetas – Decorator that enriches a RecursoAcademico
 * with a list of academic tags/categories.
 */
export class RecursoConEtiquetas implements RecursoAcademico {
  constructor(
    private readonly wrapped: RecursoAcademico,
    private readonly tags: string[],
  ) {}

  getInfo(): RecursoInfo {
    const base = this.wrapped.getInfo();
    return {
      ...base,
      tags: this.tags,
    };
  }
}
