import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { User } from '../types';

export const userService = {
  list: (): Promise<User[]> =>
    USE_MOCK ? delay([...mockDb.users]) : apiClient.get<User[]>('/api/users').then((r) => r.data),

  create: (data: { name: string; username: string; password: string; role: string }): Promise<User> => {
    if (!USE_MOCK) return apiClient.post<User>('/api/users', data).then((r) => r.data);
    const user: User = { id: uid(), name: data.name, username: data.username, role: data.role as User['role'], isActive: true, createdAt: new Date().toISOString() };
    mockDb.users.push(user);
    return delay({ ...user });
  },

  update: (id: string, data: { name: string; username: string; password?: string; role: string; isActive: boolean }): Promise<User> => {
    if (!USE_MOCK) return apiClient.put<User>(`/api/users/${id}`, data).then((r) => r.data);
    const idx = mockDb.users.findIndex((u) => u.id === id);
    if (idx !== -1) Object.assign(mockDb.users[idx], data);
    return delay({ ...mockDb.users[idx] });
  },

  deactivate: (id: string): Promise<void> => {
    if (!USE_MOCK) return apiClient.delete(`/api/users/${id}`).then((r) => r.data);
    const u = mockDb.users.find((u) => u.id === id);
    if (u) u.isActive = false;
    return delay(undefined);
  },

  reactivate: (id: string, data: { name: string; username: string; role: string }): Promise<User> => {
    if (!USE_MOCK) return apiClient.put<User>(`/api/users/${id}`, { ...data, isActive: true }).then((r) => r.data);
    const u = mockDb.users.find((u) => u.id === id);
    if (u) { u.isActive = true; Object.assign(u, data); }
    return delay({ ...u! });
  },

  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.put('/api/profile', { name: data.name, current_password: data.currentPassword, new_password: data.newPassword }).then((r) => r.data);
    if (data.name) {
      mockDb.users.forEach((u) => { if (u.isActive) u.name = data.name!; });
    }
    return delay(undefined);
  },
};
