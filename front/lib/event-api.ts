import apiClient from './api-client';

export interface UserSummary {
  id: string;
  name: string | null;
  email: string;
}

export interface UniversityEvent {
  id: string;
  title: string;
  description: string;
  eventDate: string;
  location: string | null;
  category: string;
  organizerId: string;
  createdAt: string;
  updatedAt: string;
  organizer: UserSummary;
  capacity: number;
  isFull: boolean;
  attendanceCount: number;
  isAttending: boolean;
  attendees: UserSummary[];
}

export interface EventListResponse {
  items: UniversityEvent[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateEventInput {
  title: string;
  description: string;
  eventDate: string;
  location?: string;
  category: string;
}
export interface CreateEventInputWithPrivacy extends CreateEventInput {
  isPrivate?: boolean;
}

export const eventApi = {
  getEvents: async (params?: {
    categories?: string[];
    search?: string;
    fromDate?: string;
    toDate?: string;
    availability?: 'available' | 'full';
    limit?: number;
    offset?: number;
  }): Promise<EventListResponse> => {
    const res = await apiClient.get('/events', { params });
    return res.data;
  },

  createEvent: async (data: CreateEventInputWithPrivacy): Promise<UniversityEvent> => {
    const res = await apiClient.post('/events', data);
    return res.data;
  },

  subscribeToCategory: async (category: string): Promise<any> => {
    const res = await apiClient.post('/events/subscribe', { category });
    return res.data;
  },

  unsubscribeFromCategory: async (category: string): Promise<any> => {
    const res = await apiClient.delete(`/events/subscribe/${category}`);
    return res.data;
  },

  getMySubscriptions: async (): Promise<string[]> => {
    const res = await apiClient.get('/events/subscriptions');
    return res.data;
  },

  toggleAttendance: async (id: string): Promise<{ eventId: string; attending: boolean; attendanceCount: number }> => {
    const res = await apiClient.post(`/events/${id}/attendance`);
    return res.data;
  },

  cancelAttendance: async (id: string): Promise<{ eventId: string; attending: boolean; attendanceCount: number }> => {
    const res = await apiClient.delete(`/events/${id}/attendance`);
    return res.data;
  },

  deleteEvent: async (id: string): Promise<void> => {
    const res = await apiClient.delete(`/events/${id}`);
    return res.data;
  },
  createInvitation: async (eventId: string, email: string): Promise<any> => {
    const res = await apiClient.post(`/events/${eventId}/invitations`, { email });
    return res.data;
  },

  generateQr: async (eventId: string): Promise<{ qrPng: string; token: string; attendee: UserSummary; eventDate: string }> => {
    const res = await apiClient.get(`/events/${eventId}/qr`);
    return res.data;
  },

  verifyQr: async (token: string): Promise<any> => {
    const res = await apiClient.post('/events/verify-qr', { token });
    return res.data;
  },
};
