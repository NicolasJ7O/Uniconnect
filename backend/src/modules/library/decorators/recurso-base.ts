import type { RecursoAcademico, RecursoInfo } from './recurso-academico.interface.js';

/**
 * RecursoBase – Concrete base component of the Decorator pattern.
 * Wraps a raw AcademicResource DB record and exposes the minimum required fields.
 */
export class RecursoBase implements RecursoAcademico {
  constructor(private readonly resource: {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    type: string;
    authorId: string;
    subjectId: string;
    publishedAt: Date;
    createdAt: Date;
    author: { id: string; name: string | null; avatarUrl: string | null };
  }) {}

  getInfo(): RecursoInfo {
    return {
      id: this.resource.id,
      title: this.resource.title,
      description: this.resource.description,
      url: this.resource.url,
      type: this.resource.type,
      authorId: this.resource.authorId,
      subjectId: this.resource.subjectId,
      publishedAt: this.resource.publishedAt.toISOString(),
      createdAt: this.resource.createdAt.toISOString(),
      author: this.resource.author,
    };
  }
}
