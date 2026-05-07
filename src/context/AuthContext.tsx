import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
// import axios from 'axios'; // MOCK MODE
import { MOCK_AUTH_USERS } from '../mocks/db';
import type { AuthUser, UserRole } from '../types';

// const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000'; // MOCK MODE

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

  // On mount: MOCK MODE — skip token refresh, just mark as ready
  useEffect(() => {
    // REAL API: attempt silent refresh from HttpOnly cookie
    // const attemptRefresh = async () => {
    //   try {
    //     const res = await axios.post(`${API_BASE}/api/auth/refresh`, {}, { withCredentials: true });
    //     const { access_token, user: authUser } = res.data as { access_token: string; user: AuthUser };
    //     tokenRef.current = access_token;
    //     setAccessTokenState(access_token);
    //     setUser(authUser);
    //   } catch { /* No valid session — stay logged out */ }
    //   finally { setIsLoading(false); }
    // };
    // attemptRefresh();
    setIsLoading(false); // MOCK MODE
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // REAL API:
    // const res = await axios.post(`${API_BASE}/api/auth/login`, { username, password }, { withCredentials: true });
    // const { access_token, user: authUser } = res.data as { access_token: string; user: AuthUser };

    // MOCK MODE:
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
    // REAL API:
    // try {
    //   await axios.post(`${API_BASE}/api/auth/logout`, {}, {
    //     withCredentials: true,
    //     headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {},
    //   });
    // } catch { /* Ignore logout errors */ }

    // MOCK MODE: just clear state
    tokenRef.current = null;
    setAccessTokenState(null);
    setUser(null);
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
