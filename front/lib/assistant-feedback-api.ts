import apiClient from './api-client';

export type AssistantFeedbackPayload = {
  assistantMessageId: string;
  sessionId?: string;
  question: string;
  answer: string;
  rating: 'USEFUL' | 'NOT_USEFUL';
  comment?: string;
  chunks?: unknown;
};

export type AssistantFeedbackReportItem = {
  question: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  samples: Array<{
    id: string;
    userId: string;
    userRole: string;
    answer: string;
    comment?: string | null;
    createdAt: string;
  }>;
};

export type AssistantFeedbackReport = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  items: AssistantFeedbackReportItem[];
};

export const assistantFeedbackApi = {
  async submit(payload: AssistantFeedbackPayload) {
    const response = await apiClient.post('/assistant/feedback', payload);
    return response.data;
  },

  async getReport(params?: Record<string, string | number>) {
    const response = await apiClient.get<AssistantFeedbackReport>('/assistant/feedback/report', { params });
    return response.data;
  },

  async exportCsv() {
    const response = await apiClient.get('/assistant/feedback/export.csv', { responseType: 'blob' });
    return response.data;
  },
};
