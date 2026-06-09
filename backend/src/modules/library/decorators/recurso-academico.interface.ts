/**
 * Decorator Pattern – Interfaz base del Recurso Académico.
 * Todas las variantes (base y decoradores) implementan esta interfaz.
 */

export interface OGPreview {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogSiteName: string | null;
}

export interface ResourceStatsInfo {
  views: number;
  downloads: number;
  votes: number;
}

export interface RecursoInfo {
  // RecursoBase fields
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  type: string;
  authorId: string;
  subjectId: string;
  publishedAt: string;
  createdAt: string;
  author: { id: string; name: string | null; avatarUrl: string | null };

  // Decorator extensions (undefined if decorator not applied)
  openGraph?: OGPreview | null;
  tags?: string[];
  stats?: ResourceStatsInfo | null;
}

export interface RecursoAcademico {
  getInfo(): RecursoInfo;
}
