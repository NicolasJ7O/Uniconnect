import type { RecursoAcademico, RecursoInfo, ResourceStatsInfo } from './recurso-academico.interface.js';

/**
 * RecursoConEstadisticas – Decorator that enriches a RecursoAcademico
 * with usage metrics: views, downloads and votes.
 */
export class RecursoConEstadisticas implements RecursoAcademico {
  constructor(
    private readonly wrapped: RecursoAcademico,
    private readonly stats: ResourceStatsInfo | null,
  ) {}

  getInfo(): RecursoInfo {
    const base = this.wrapped.getInfo();
    return {
      ...base,
      stats: this.stats,
    };
  }
}
