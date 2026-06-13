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
  poll?: ChatPoll;
}

export interface ChatPollOption {
  id: string;
  label: string;
  position: number;
  votes: number;
  voterIds: string[];
  percentage: number;
}

export interface ChatPoll {
  id: string;
  messageId: string;
  groupId: string;
  creatorId: string;
  question: string;
  allowMultiple: boolean;
  maxSelections: number;
  closingAt?: string | null;
  closedAt?: string | null;
  status: 'ACTIVE' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  totalVotes: number;
  participantCount: number;
  participantIds: string[];
  options: ChatPollOption[];
}

export interface CreatePollPayload {
  question?: string;
  options: string[];
  allowMultiple?: boolean;
  maxSelections?: number;
  closingAt?: string | null;
  durationMinutes?: number | null;
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

  sendGroupMessage: async (groupId: string, content: string, file?: any, poll?: CreatePollPayload): Promise<ChatMessage> => {
    const formData = new FormData();
    formData.append('content', content);
    if (file) {
      formData.append('file', file as any);
    }
    if (poll) {
      formData.append('poll', JSON.stringify(poll));
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
  },

  voteOnPoll: async (groupId: string, pollId: string, optionIds: string[]): Promise<ChatPoll> => {
    const response = await apiClient.post<ChatPoll>(`/chat/group/${groupId}/polls/${pollId}/votes`, { optionIds });
    return response.data;
  },

  getPoll: async (groupId: string, pollId: string): Promise<ChatPoll> => {
    const response = await apiClient.get<ChatPoll>(`/chat/group/${groupId}/polls/${pollId}`);
    return response.data;
  }
};
