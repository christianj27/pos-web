// import { apiClient } from '../hooks/useApi'; // MOCK MODE
import { mockDb, delay } from '../mocks/db';
import type { DashboardStats } from '../types';

export const dashboardService = {
  getStats: (): Promise<DashboardStats> => {
    // return apiClient.get<DashboardStats>('/api/dashboard').then((r) => r.data);
    // Compute live totals from mock state
    const totalDebt = mockDb.customers.reduce((s, c) => s + (c.outstanding_debt ?? 0), 0);
    return delay({ ...mockDb.dashboardStats, total_outstanding_debt: totalDebt });
  },
};
