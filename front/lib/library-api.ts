import apiClient from './api-client';

// ─── Shared types (mirror backend RecursoInfo) ───────────────────────────────

export type ResourceType = 'LINK' | 'PDF' | 'VIDEO' | 'DOCUMENTO' | 'OTRO';

export type UserMin = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type OGPreview = {
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogSiteName: string | null;
};

export type ResourceStatsInfo = {
  views: number;
  downloads: number;
  votes: number;
};

export type AcademicResource = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  type: ResourceType;
  authorId: string;
  subjectId: string;
  publishedAt: string;
  createdAt: string;
  author: UserMin;
  // Decorator fields
  openGraph?: OGPreview | null;
  tags?: string[];
  stats?: ResourceStatsInfo | null;
};

export type PaginatedResources = {
  data: AcademicResource[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

export type ListResourcesParams = {
  search?: string;
  type?: ResourceType;
  tag?: string;
  sortBy?: 'recent' | 'popular';
  page?: number;
  limit?: number;
};

export type CreateResourcePayload = {
  title: string;
  description?: string;
  url?: string;
  type: ResourceType;
  tags?: string[];
};

export type UpdateResourcePayload = {
  title?: string;
  description?: string;
  url?: string;
  type?: ResourceType;
  tags?: string[];
};

// ─── API client ───────────────────────────────────────────────────────────────

export const libraryApi = {
  listResources: async (
    subjectId: string,
    params: ListResourcesParams = {},
  ): Promise<PaginatedResources> => {
    const response = await apiClient.get<PaginatedResources>(
      `/library/subjects/${subjectId}/resources`,
      { params },
    );
    return response.data;
  },

  getResource: async (resourceId: string): Promise<AcademicResource> => {
    const response = await apiClient.get<AcademicResource>(`/library/resources/${resourceId}`);
    return response.data;
  },

  createResource: async (
    subjectId: string,
    payload: CreateResourcePayload,
  ): Promise<AcademicResource> => {
    const response = await apiClient.post<AcademicResource>(
      `/library/subjects/${subjectId}/resources`,
      payload,
    );
    return response.data;
  },

  updateResource: async (
    resourceId: string,
    payload: UpdateResourcePayload,
  ): Promise<AcademicResource> => {
    const response = await apiClient.patch<AcademicResource>(
      `/library/resources/${resourceId}`,
      payload,
    );
    return response.data;
  },

  deleteResource: async (resourceId: string): Promise<void> => {
    await apiClient.delete(`/library/resources/${resourceId}`);
  },

  voteResource: async (resourceId: string, value: 1 | -1): Promise<AcademicResource> => {
    const response = await apiClient.post<AcademicResource>(
      `/library/resources/${resourceId}/vote`,
      { value },
    );
    return response.data;
  },
};
