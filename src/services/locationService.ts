import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { Location } from '../types';

export const locationService = {
  list: (): Promise<Location[]> =>
    USE_MOCK ? delay([...mockDb.locations]) : apiClient.get<Location[]>('/api/locations').then((r) => r.data),

  create: (data: { name: string; type: string; assignedTo?: string }): Promise<Location> => {
    if (!USE_MOCK) return apiClient.post<Location>('/api/locations', data).then((r) => r.data);
    const assignedUser = data.assignedTo ? mockDb.users.find((u) => u.id === data.assignedTo) : undefined;
    const loc: Location = {
      id: uid(), name: data.name, type: data.type as Location['type'],
      assignedTo: data.assignedTo, assignedToName: assignedUser?.name,
      isActive: true, createdAt: new Date().toISOString(),
    };
    mockDb.locations.push(loc);
    return delay({ ...loc });
  },

  update: (id: string, data: { name?: string; assignedTo?: string; isActive?: boolean }): Promise<Location> => {
    if (!USE_MOCK) return apiClient.put<Location>(`/api/locations/${id}`, data).then((r) => r.data);
    const idx = mockDb.locations.findIndex((l) => l.id === id);
    if (idx !== -1) {
      if (data.name) mockDb.locations[idx].name = data.name;
      if ('assignedTo' in data) {
        mockDb.locations[idx].assignedTo = data.assignedTo;
        const u = data.assignedTo ? mockDb.users.find((u) => u.id === data.assignedTo) : undefined;
        mockDb.locations[idx].assignedToName = u?.name;
      }
    }
    return delay({ ...mockDb.locations[idx] });
  },

  deactivate: (id: string, data: { name?: string; assignedTo?: string; isActive?: boolean }): Promise<void> => {
    if (!USE_MOCK) return apiClient.put(`/api/locations/${id}`, data).then((r) => r.data);
    const l = mockDb.locations.find((l) => l.id === id);
    if (l) l.isActive = false;
    return delay(undefined);
  },
};
