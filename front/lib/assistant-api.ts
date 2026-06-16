import apiClient from './api-client';

export type AssistantSpeakerRole = 'user' | 'assistant' | 'system';

export type AssistantReference = {
  reference: string;
};

export type AssistantMessageMetadata = {
  role?: string;
  answerType?: 'STANDARD' | 'ADMIN' | 'REFUSAL' | string;
  references?: AssistantReference[];
  [key: string]: unknown;
} | null;

export type AssistantMessage = {
  id: string;
  sessionId: string;
  speakerRole: AssistantSpeakerRole;
  content: string;
  metadata: AssistantMessageMetadata;
  createdAt: string;
};

export type AssistantSession = {
  id: string;
  userId: string;
  sessionKey: string;
  role: string;
  roleLabel: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
  messages: AssistantMessage[];
};

export type AssistantSendResponse = {
  session: AssistantSession;
  userMessage: AssistantMessage;
  assistantMessage: AssistantMessage;
  role: string;
  roleLabel: string;
  answerType: string;
};

export const assistantApi = {
  async getSessionHistory(sessionKey: string): Promise<AssistantSession> {
    const response = await apiClient.get<AssistantSession>(`/assistant/session/${sessionKey}`);
    return response.data;
  },

  async sendMessage(sessionKey: string, message: string): Promise<AssistantSendResponse> {
    const response = await apiClient.post<AssistantSendResponse>(
      `/assistant/session/${sessionKey}/messages`, 
      { message },
      { timeout: 45000 } // Overrides default 10s timeout to allow LLM generation
    );
    return response.data;
  },
};
