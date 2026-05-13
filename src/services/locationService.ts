import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { Location } from '../types';

export const locationService = {
  list: (): Promise<Location[]> =>
    USE_MOCK ? delay([...mockDb.locations]) : apiClient.get<Location[]>('/api/locations').then((r) => r.data),

  create: (data: { name: string; type: string; assigned_to?: string }): Promise<Location> => {
    if (!USE_MOCK) return apiClient.post<Location>('/api/locations', data).then((r) => r.data);
    const assignedUser = data.assigned_to ? mockDb.users.find((u) => u.id === data.assigned_to) : undefined;
    const loc: Location = {
      id: uid(), name: data.name, type: data.type as Location['type'],
      assigned_to: data.assigned_to, assigned_to_name: assignedUser?.name,
      is_active: true, created_at: new Date().toISOString(),
    };
    mockDb.locations.push(loc);
    return delay({ ...loc });
  },

  update: (id: string, data: { name?: string; assigned_to?: string }): Promise<Location> => {
    if (!USE_MOCK) return apiClient.put<Location>(`/api/locations/${id}`, data).then((r) => r.data);
    const idx = mockDb.locations.findIndex((l) => l.id === id);
    if (idx !== -1) {
      if (data.name) mockDb.locations[idx].name = data.name;
      if ('assigned_to' in data) {
        mockDb.locations[idx].assigned_to = data.assigned_to;
        const u = data.assigned_to ? mockDb.users.find((u) => u.id === data.assigned_to) : undefined;
        mockDb.locations[idx].assigned_to_name = u?.name;
      }
    }
    return delay({ ...mockDb.locations[idx] });
  },

  deactivate: (id: string): Promise<void> => {
    if (!USE_MOCK) return apiClient.put(`/api/locations/${id}`, { is_active: false }).then((r) => r.data);
    const l = mockDb.locations.find((l) => l.id === id);
    if (l) l.is_active = false;
    return delay(undefined);
  },
};
