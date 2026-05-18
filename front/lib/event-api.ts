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
}

export interface CreateEventInput {
  title: string;
  description: string;
  eventDate: string;
  location?: string;
  category: string;
}

export const eventApi = {
  getEvents: async (category?: string): Promise<UniversityEvent[]> => {
    const res = await apiClient.get('/events', {
      params: category && category !== 'TODOS' ? { category } : undefined,
    });
    return res.data;
  },

  createEvent: async (data: CreateEventInput): Promise<UniversityEvent> => {
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

  deleteEvent: async (id: string): Promise<void> => {
    const res = await apiClient.delete(`/events/${id}`);
    return res.data;
  },
};
