import apiClient from './api-client';

export type StudySessionParticipant = {
  sessionId: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

export type StudySessionReminder = {
  id: string;
  sessionId: string;
  minutesBefore: number;
  scheduledAt: string;
  sentAt: string | null;
  channel: 'DATABASE' | 'WEBSOCKET';
  notificationId: string | null;
  createdAt: string;
};

export type StudySessionSeries = {
  id: string;
  title: string;
  description: string | null;
  subjectId: string;
  creatorId: string;
  baseStartAt: string;
  durationMinutes: number;
  recurrenceConfig: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'INTERVAL';
    interval: number;
    endDate: string;
    daysOfWeek?: number[] | null;
    dayOfMonth?: number | null;
  };
  reminderMinutes: number[] | null;
  status: 'SCHEDULED' | 'CANCELED' | 'COMPLETED';
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudySessionSubject = {
  id: string;
  name: string;
  code: string | null;
};

export type StudySessionUser = {
  id: string;
  name: string | null;
  email: string;
};

export type StudySession = {
  id: string;
  seriesId: string | null;
  title: string;
  description: string | null;
  subjectId: string;
  creatorId: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  occurrenceIndex: number;
  status: 'SCHEDULED' | 'CANCELED' | 'COMPLETED';
  canceledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  subject: StudySessionSubject;
  creator: StudySessionUser;
  participants: StudySessionParticipant[];
  reminders: StudySessionReminder[];
  series: StudySessionSeries | null;
};

export type CreateStudySessionPayload = {
  title: string;
  description?: string;
  subjectId: string;
  startAt: string;
  durationMinutes: number;
  participantIds?: string[];
  reminders: { minutesBefore: number }[];
  recurrence?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'INTERVAL';
    interval: number;
    endDate: string;
    daysOfWeek?: number[];
    dayOfMonth?: number;
  };
};

export type UpdateStudySessionPayload = Partial<Pick<CreateStudySessionPayload, 'title' | 'description' | 'startAt' | 'durationMinutes'>> & {
  participantIds?: string[];
  reminders?: { minutesBefore: number }[];
};

export type UpdateStudySessionSeriesPayload = {
  title?: string;
  description?: string;
  subjectId?: string;
  startAt?: string;
  durationMinutes?: number;
  participantIds?: string[];
  reminders?: { minutesBefore: number }[];
  recurrence?: CreateStudySessionPayload['recurrence'];
  effectiveFrom?: string;
};

export const studySessionApi = {
  getSessions: async (): Promise<StudySession[]> => {
    const response = await apiClient.get('/study-sessions');
    return response.data;
  },
  getSessionById: async (sessionId: string): Promise<StudySession> => {
    const response = await apiClient.get(`/study-sessions/${sessionId}`);
    return response.data;
  },
  createSession: async (payload: CreateStudySessionPayload) => {
    const response = await apiClient.post('/study-sessions', payload);
    return response.data;
  },
  updateSession: async (sessionId: string, payload: UpdateStudySessionPayload) => {
    const response = await apiClient.put(`/study-sessions/${sessionId}`, payload);
    return response.data;
  },
  updateSeries: async (seriesId: string, payload: UpdateStudySessionSeriesPayload) => {
    const response = await apiClient.put(`/study-sessions/series/${seriesId}`, payload);
    return response.data;
  },
  cancelSession: async (sessionId: string, reason?: string) => {
    const response = await apiClient.delete(`/study-sessions/${sessionId}`, {
      data: reason ? { reason } : {},
    });
    return response.data;
  },
  cancelSeries: async (seriesId: string) => {
    const response = await apiClient.delete(`/study-sessions/series/${seriesId}`);
    return response.data;
  },
};

