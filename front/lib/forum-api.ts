import apiClient from './api-client';

export type UserMin = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type ForumQuestion = {
  id: string;
  title: string;
  content: string;
  subjectId: string;
  authorId: string;
  score: number;
  createdAt: string;
  updatedAt: string;
  author: UserMin;
  answers?: ForumAnswer[];
};

export type ForumAnswer = {
  id: string;
  content: string;
  questionId: string;
  authorId: string;
  isAccepted: boolean;
  score: number;
  createdAt: string;
  updatedAt: string;
  author: UserMin;
};

export type ForumAuditLog = {
  id: string;
  userId: string;
  action: 'CREATE_QUESTION' | 'UPDATE_QUESTION' | 'CREATE_ANSWER' | 'VOTE_QUESTION' | 'VOTE_ANSWER' | 'ACCEPT_ANSWER';
  subjectId: string;
  targetId: string;
  metadata?: any;
  createdAt: string;
};

export type ForumHistory = {
  questions: ForumQuestion[];
  answers: (ForumAnswer & { question: { title: string } })[];
  logs: ForumAuditLog[];
};

export const forumApi = {
  getSubjectQuestions: async (subjectId: string): Promise<ForumQuestion[]> => {
    const response = await apiClient.get<ForumQuestion[]>(`/forum/subjects/${subjectId}/questions`);
    return response.data;
  },

  getQuestionThread: async (questionId: string): Promise<ForumQuestion & { answers: ForumAnswer[] }> => {
    const response = await apiClient.get<ForumQuestion & { answers: ForumAnswer[] }>(`/forum/questions/${questionId}`);
    return response.data;
  },

  createQuestion: async (subjectId: string, title: string, content: string): Promise<ForumQuestion> => {
    const response = await apiClient.post<ForumQuestion>(`/forum/subjects/${subjectId}/questions`, { title, content });
    return response.data;
  },

  createAnswer: async (questionId: string, content: string): Promise<ForumAnswer> => {
    const response = await apiClient.post<ForumAnswer>(`/forum/questions/${questionId}/answers`, { content });
    return response.data;
  },

  voteQuestion: async (questionId: string, value: number): Promise<ForumQuestion> => {
    const response = await apiClient.post<ForumQuestion>(`/forum/questions/${questionId}/vote`, { value });
    return response.data;
  },

  voteAnswer: async (answerId: string, value: number): Promise<ForumAnswer> => {
    const response = await apiClient.post<ForumAnswer>(`/forum/answers/${answerId}/vote`, { value });
    return response.data;
  },

  acceptAnswer: async (answerId: string): Promise<ForumAnswer> => {
    const response = await apiClient.post<ForumAnswer>(`/forum/answers/${answerId}/accept`);
    return response.data;
  },

  getForumHistory: async (subjectId: string): Promise<ForumHistory> => {
    const response = await apiClient.get<ForumHistory>(`/forum/subjects/${subjectId}/history`);
    return response.data;
  },
};
