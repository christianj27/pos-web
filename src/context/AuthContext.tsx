import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { USE_MOCK, MOCK_AUTH_USERS } from '../mocks/db';
import { setApiCredentialHandlers } from '../hooks/useApi';
import type { AuthUser, UserRole } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setAccessToken: (token: string, user: AuthUser) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);

  const setAccessToken = useCallback((token: string, authUser: AuthUser) => {
    tokenRef.current = token;
    setAccessTokenState(token);
    setUser(authUser);
  }, []);

  // On mount: attempt silent token refresh (real API) or skip (mock)
  useEffect(() => {
    if (USE_MOCK) {
      setIsLoading(false);
      return;
    }
    const attemptRefresh = async () => {
      try {
        const res = await axios.post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true });
        const { accessToken } = res.data as { accessToken: string };
        const claims = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const authUser: AuthUser = {
          id: claims['sub'],
          name: claims['name'],
          username: claims['unique_name'],
          role: claims['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] as AuthUser['role'],
        };
        tokenRef.current = accessToken;
        setAccessTokenState(accessToken);
        setUser(authUser);
      } catch { /* No valid session — stay logged out */ }
      finally { setIsLoading(false); }
    };
    attemptRefresh();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    if (!USE_MOCK) {
      const res = await axios.post(`${API_BASE}/api/auth/login`, { username, password }, { withCredentials: true });
      const { accessToken, userId, name, username: uname, role } = res.data as { accessToken: string; userId: string; name: string; username: string; role: AuthUser['role'] };
      const authUser: AuthUser = { id: userId, name, username: uname, role };
      tokenRef.current = accessToken;
      setAccessTokenState(accessToken);
      setUser(authUser);
      return authUser;
    }

    await new Promise((r) => setTimeout(r, 500)); // simulate network delay
    const found = MOCK_AUTH_USERS.find((u) => u.username === username && u.password === password);
    if (!found) throw Object.assign(new Error('Invalid credentials'), { response: { status: 401 } });
    const authUser: AuthUser = { id: found.id, name: found.name, username: found.username, role: found.role };
    const access_token = `mock-token-${Date.now()}`;

    tokenRef.current = access_token;
    setAccessTokenState(access_token);
    setUser(authUser);
    return authUser;
  }, []);

  const logout = useCallback(async () => {
    if (!USE_MOCK) {
      try {
        await axios.post(`${API_BASE}/api/auth/logout`, {}, {
          withCredentials: true,
          headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
        });
      } catch { /* Ignore logout errors */ }
    }

    tokenRef.current = null;
    setAccessTokenState(null);
    setUser(null);
  }, []);

  // Wire the shared apiClient interceptor to always use the latest token via tokenRef.
  // This ensures all service calls include the Authorization header, even without useApi().
  useEffect(() => {
    setApiCredentialHandlers(
      () => tokenRef.current,
      () => {
        // Clear all in-memory tokens immediately
        tokenRef.current = null;
        setAccessTokenState(null);
        setUser(null);
        // Fire-and-forget: ask server to clear the HTTP-only refresh token cookie
        axios.post(`${API_BASE}/api/auth/logout`, {}, { withCredentials: true }).catch(() => {});
        // Hard redirect — replaces history entry so the user cannot navigate back
        window.location.replace('/login');
      }
    );
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, logout, setAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}

export function getRoleDefaultPath(role: UserRole): string {
  if (role === 'owner') return '/dashboard';
  return '/transactions';
}
