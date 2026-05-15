import apiClient from './api-client';
import type { SessionData } from '@/lib/session';

export async function signInWithGoogleIdToken(idToken: string): Promise<SessionData> {
  const response = await apiClient.post<SessionData>('/auth/google', { idToken });
  return response.data;
}

export async function signInSimple(email: string, name: string): Promise<SessionData> {
  const response = await apiClient.post<SessionData>('/auth/simple', { email, name });
  return response.data;
}

export async function signInWithAuth0(accessToken: string): Promise<SessionData> {
  const response = await apiClient.post<SessionData>('/auth/auth0', { accessToken });
  return response.data;
}

export async function refreshSessionToken(refreshToken: string): Promise<SessionData> {
  const response = await apiClient.post<SessionData>('/auth/refresh', { refreshToken }, { handleError: false });
  return response.data;
}

export async function logoutWithRefreshToken(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refreshToken });
}
