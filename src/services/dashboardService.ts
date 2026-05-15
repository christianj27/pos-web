import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, delay } from '../mocks/db';
import type { DashboardStats } from '../types';

export const dashboardService = {
  getStats: (_date?: string): Promise<DashboardStats> => {
    if (!USE_MOCK) return apiClient.get<DashboardStats>(`/api/dashboard${_date ? `?date=${_date}` : ''}`).then((r) => r.data);
    // Compute live totals from mock state
    const totalDebt       = mockDb.customers.reduce((s, c) => s + (c.outstandingDebt ?? 0), 0);
    const debtCollected   = mockDb.debtPayments.reduce((s, p) => s + p.amount, 0);
    // previousDayRevenue = 6th entry (index 5) in the weeklyChart (day before selected/today)
    const prevDayRevenue  = mockDb.dashboardStats.weeklyChart[5]?.revenue ?? 0;
    const customerDebts   = mockDb.customers
      .filter((c) => c.isActive && (c.outstandingDebt ?? 0) > 0)
      .sort((a, b) => (b.outstandingDebt ?? 0) - (a.outstandingDebt ?? 0))
      .map((c) => ({ customerId: c.id, customerName: c.name, outstandingDebt: c.outstandingDebt ?? 0 }));
    return delay({
      ...mockDb.dashboardStats,
      totalOutstandingDebt: totalDebt,
      todayDebtCollected:   debtCollected,
      previousDayRevenue:   prevDayRevenue,
      customerDebts,
    });
  },
};
