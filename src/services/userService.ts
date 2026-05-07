// import { apiClient } from '../hooks/useApi'; // MOCK MODE
import { mockDb, uid, delay } from '../mocks/db';
import type { User } from '../types';

export const userService = {
  list: (): Promise<User[]> =>
    // apiClient.get<User[]>('/api/users').then((r) => r.data),
    delay([...mockDb.users]),

  create: (data: { name: string; username: string; password: string; role: string }): Promise<User> => {
    // return apiClient.post<User>('/api/users', data).then((r) => r.data);
    const user: User = { id: uid(), name: data.name, username: data.username, role: data.role as User['role'], is_active: true, created_at: new Date().toISOString() };
    mockDb.users.push(user);
    return delay({ ...user });
  },

  update: (id: string, data: { name?: string; username?: string; role?: string }): Promise<User> => {
    // return apiClient.put<User>(`/api/users/${id}`, data).then((r) => r.data);
    const idx = mockDb.users.findIndex((u) => u.id === id);
    if (idx !== -1) Object.assign(mockDb.users[idx], data);
    return delay({ ...mockDb.users[idx] });
  },

  deactivate: (id: string): Promise<void> => {
    // return apiClient.delete(`/api/users/${id}`).then((r) => r.data);
    const u = mockDb.users.find((u) => u.id === id);
    if (u) u.is_active = false;
    return delay(undefined);
  },

  reactivate: (id: string): Promise<User> => {
    // return apiClient.put<User>(`/api/users/${id}`, { is_active: true }).then((r) => r.data);
    const u = mockDb.users.find((u) => u.id === id);
    if (u) u.is_active = true;
    return delay({ ...u! });
  },

  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }): Promise<void> => {
    // return apiClient.put('/api/profile', { name: data.name, current_password: data.currentPassword, new_password: data.newPassword }).then((r) => r.data);
    if (data.name) {
      mockDb.users.forEach((u) => { if (u.is_active) u.name = data.name!; });
    }
    return delay(undefined);
  },
};
