import axios from 'axios';
import type { AuthResult, ApiResponse } from '@suivi/contracts';
import { useAuthStore } from '../stores/auth';
import { queryClient } from './query-client';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 35000,
  withCredentials: true,
  headers: { Accept: 'application/json', 'X-SUIVI-CLIENT': 'web' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
});
let refreshing: Promise<AuthResult> | null = null;
export async function restoreSession() {
  const rotate = async () => {
    const r = await api.post<ApiResponse<AuthResult>>('/auth/refresh');
    const previous = useAuthStore.getState().user;
    if (
      previous &&
      (previous.id !== r.data.data.user.id ||
        previous.role !== r.data.data.user.role ||
        previous.departmentId !== r.data.data.user.departmentId)
    ) {
      queryClient.clear();
      useAuthStore.getState().clear();
      throw new Error(
        'L’identité de la session a changé. Reconnectez-vous avant de reprendre cette action.',
      );
    }
    useAuthStore.getState().accept(r.data.data);
    return r.data.data;
  };
  refreshing ??= (
    navigator.locks ? navigator.locks.request('suivi.refresh', rotate) : rotate()
  ).finally(() => {
    refreshing = null;
  });
  return refreshing;
}
api.interceptors.response.use(
  (r) => r,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) return Promise.reject(error);
    const config = error.config;
    if (
      error.response?.status === 401 &&
      !config.url?.startsWith('/auth/') &&
      useAuthStore.getState().token &&
      !config.headers['X-SUIVI-Retry']
    ) {
      try {
        await restoreSession();
        config.headers['X-SUIVI-Retry'] = '1';
        return await api.request(config);
      } catch {
        queryClient.clear();
        useAuthStore.getState().clear();
      }
    }
    return Promise.reject(error);
  },
);
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error))
    return (
      error.response?.data.error?.message ??
      (error.response
        ? 'La requête a échoué.'
        : 'Le serveur est injoignable. Vérifiez votre connexion puis réessayez.')
    );
  return error instanceof Error ? error.message : 'Une erreur est survenue.';
}
export function deviceFor(login: string): string {
  const key = 'suivi.device.' + login.trim().normalize('NFKC').toLowerCase();
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
