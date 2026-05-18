import apiClient from './api-client';

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationApi = {
  getNotifications: async (): Promise<Notification[]> => {
    const res = await apiClient.get('/notifications');
    return res.data;
  },

  markAsRead: async (id: string): Promise<void> => {
    const res = await apiClient.put(`/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async (): Promise<void> => {
    const res = await apiClient.put('/notifications/mark-all-read');
    return res.data;
  },

  deleteNotification: async (id: string): Promise<void> => {
    const res = await apiClient.delete(`/notifications/${id}`);
    return res.data;
  }
};
