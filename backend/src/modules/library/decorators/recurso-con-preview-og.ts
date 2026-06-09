import type { RecursoAcademico, RecursoInfo, OGPreview } from './recurso-academico.interface.js';

/**
 * RecursoConPreviewOpenGraph – Decorator that enriches a RecursoAcademico
 * with Open Graph metadata (title, description, image, siteName) fetched
 * asynchronously from an external URL.
 */
export class RecursoConPreviewOpenGraph implements RecursoAcademico {
  constructor(
    private readonly wrapped: RecursoAcademico,
    private readonly ogData: OGPreview | null,
  ) {}

  getInfo(): RecursoInfo {
    const base = this.wrapped.getInfo();
    return {
      ...base,
      openGraph: this.ogData,
    };
  }
}
