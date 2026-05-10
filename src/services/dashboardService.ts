// import { apiClient } from '../hooks/useApi'; // MOCK MODE
import { mockDb, delay } from '../mocks/db';
import type { DashboardStats } from '../types';

export const dashboardService = {
  getStats: (_date?: string): Promise<DashboardStats> => {
    // return apiClient.get<DashboardStats>(`/api/dashboard${_date ? `?date=${_date}` : ''}`).then((r) => r.data);
    // Compute live totals from mock state
    const totalDebt       = mockDb.customers.reduce((s, c) => s + (c.outstanding_debt ?? 0), 0);
    const debtCollected   = mockDb.debtPayments.reduce((s, p) => s + p.amount, 0);
    // previous_day_revenue = 6th entry (index 5) in the weekly_chart (day before selected/today)
    const prevDayRevenue  = mockDb.dashboardStats.weekly_chart[5]?.revenue ?? 0;
    const customerDebts   = mockDb.customers
      .filter((c) => c.is_active && (c.outstanding_debt ?? 0) > 0)
      .sort((a, b) => (b.outstanding_debt ?? 0) - (a.outstanding_debt ?? 0))
      .map((c) => ({ customer_id: c.id, customer_name: c.name, outstanding_debt: c.outstanding_debt ?? 0 }));
    return delay({
      ...mockDb.dashboardStats,
      total_outstanding_debt: totalDebt,
      today_debt_collected:   debtCollected,
      previous_day_revenue:   prevDayRevenue,
      customer_debts:         customerDebts,
    });
  },
};
