import apiClient from './api-client';

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  groupId?: string;
  receiverId?: string;
  isPrivate: boolean;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  createdAt: string;
}

export type Conversation = {
  user: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  lastMessage: {
    content: string;
    createdAt: string;
    fileUrl?: string;
  };
};

export interface PaginatedChatResponse {
  messages: ChatMessage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const chatApi = {
  getGroupHistory: async (groupId: string, page = 1, limit = 20): Promise<PaginatedChatResponse> => {
    const { data } = await apiClient.get(`/chat/group/${groupId}?page=${page}&limit=${limit}`);
    return data;
  },

  sendGroupMessage: async (groupId: string, content: string, file?: any): Promise<ChatMessage> => {
    const formData = new FormData();
    formData.append('content', content);
    if (file) {
      formData.append('file', file as any);
    }
    const { data } = await apiClient.post(`/chat/group/${groupId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getPrivateHistory: async (otherUserId: string, page = 1, limit = 20): Promise<PaginatedChatResponse> => {
    const { data } = await apiClient.get(`/chat/private/${otherUserId}?page=${page}&limit=${limit}`);
    return data;
  },

  sendPrivateMessage: async (otherUserId: string, content: string, file?: any): Promise<ChatMessage> => {
    const formData = new FormData();
    formData.append('content', content);
    if (file) {
      formData.append('file', file as any);
    }
    const response = await apiClient.post<ChatMessage>(`/chat/private/${otherUserId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async getConversations(): Promise<Conversation[]> {
    const response = await apiClient.get<Conversation[]>('/chat/conversations');
    return response.data;
  }
};
