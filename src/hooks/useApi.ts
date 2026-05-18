import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useCallback } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { ApiError } from '../utils/apiError';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Shared axios instance (created once per module)
export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// We keep a mutable ref to the token accessor & logout fn so interceptors can use them
let _getToken: (() => string | null) | null = null;
let _refreshing: Promise<string | null> | null = null;
let _onAuthFailure: (() => void) | null = null;

export function setApiCredentialHandlers(
  getToken: () => string | null,
  onAuthFailure: () => void
) {
  _getToken = getToken;
  _onAuthFailure = onAuthFailure;
}

// Request interceptor — attach access token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = _getToken?.();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 with token refresh
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (!_refreshing) {
        _refreshing = axios
          .post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true })
          .then((res) => {
            const newToken = res.data.access_token as string;
            return newToken;
          })
          .catch(() => {
            _onAuthFailure?.();
            return null;
          })
          .finally(() => {
            _refreshing = null;
          });
      }

      const newToken = await _refreshing;
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }

    if (error.response) {
      const data = error.response.data as { message?: string; errors?: Record<string, string[]> } | undefined;
      return Promise.reject(new ApiError(
        data?.message ?? 'Terjadi kesalahan.',
        error.response.status,
        data?.errors,
      ));
    }
    return Promise.reject(new ApiError('Tidak dapat terhubung ke server.', 0));
  }
);

/**
 * Hook that returns an API client bound to the current auth session.
 */
export function useApi() {
  const { setAccessToken } = useAuthContext();

  const get = useCallback(<T>(url: string, params?: Record<string, unknown>) =>
    apiClient.get<T>(url, { params }).then((r) => r.data), []);

  const post = useCallback(<T>(url: string, data?: unknown) =>
    apiClient.post<T>(url, data).then((r) => r.data), []);

  const put = useCallback(<T>(url: string, data?: unknown) =>
    apiClient.put<T>(url, data).then((r) => r.data), []);

  const del = useCallback(<T>(url: string) =>
    apiClient.delete<T>(url).then((r) => r.data), []);

  return { get, post, put, del, setAccessToken };
}
