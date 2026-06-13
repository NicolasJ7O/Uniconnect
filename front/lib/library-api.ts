import apiClient from './api-client';

// ─── Shared types (mirror backend RecursoInfo) ───────────────────────────────

export type ResourceType = 'LINK' | 'PDF' | 'IMAGE' | 'VIDEO' | 'DOCUMENTO' | 'OTRO';

export type UserMin = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type SubjectMin = {
  id: string;
  name: string;
  code: string | null;
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
  subject: SubjectMin;
  publishedAt: string;
  createdAt: string;
  author: UserMin;
  // Decorator fields
  openGraph?: OGPreview | null;
  tags?: string[];
  categories?: string[];
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
  categories?: string[];
};

export type UpdateResourcePayload = {
  title?: string;
  description?: string;
  url?: string;
  type?: ResourceType;
  tags?: string[];
  categories?: string[];
};

export type ResourceAttachment = {
  uri?: string;
  mimeType?: string;
  name?: string;
  fileName?: string;
  file?: File | Blob;
  type?: string;
};

function appendAttachment(formData: FormData, attachment: ResourceAttachment) {
  if (attachment.file) {
    formData.append(
      'file',
      attachment.file as any,
      attachment.name || attachment.fileName || 'file',
    );
    return;
  }

  if (!attachment.uri) {
    return;
  }

  formData.append('file', {
    uri: attachment.uri,
    type: attachment.mimeType || attachment.type || 'application/octet-stream',
    name: attachment.name || attachment.fileName || `file_${Date.now()}`,
  } as any);
}

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
    attachment?: ResourceAttachment,
  ): Promise<AcademicResource> => {
    let dataOrForm: any;
    let headers = {};

    if (attachment) {
      const formData = new FormData();
      formData.append('title', payload.title);
      formData.append('type', payload.type);
      if (payload.description) formData.append('description', payload.description);
      if (payload.tags && payload.tags.length > 0) {
        formData.append('tags', payload.tags.join(','));
      }
      if (payload.categories && payload.categories.length > 0) {
        formData.append('categories', payload.categories.join(','));
      }
      appendAttachment(formData, attachment);
      dataOrForm = formData;
      headers = { 'Content-Type': 'multipart/form-data' };
    } else {
      dataOrForm = payload;
    }

    const response = await apiClient.post<AcademicResource>(
      `/library/subjects/${subjectId}/resources`,
      dataOrForm,
      { headers }
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
