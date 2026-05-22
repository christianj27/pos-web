import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, delay } from '../mocks/db';
import type { AuthUser, DashboardStats, StaffRevenueSummary } from '../types';

export const dashboardService = {
  getStats: (_date?: string, _user?: AuthUser | null): Promise<DashboardStats> => {
    if (!USE_MOCK) return apiClient.get<DashboardStats>(`/api/dashboard${_date ? `?date=${_date}` : ''}`).then((r) => r.data);

    const isOwner = !_user || _user.role === 'owner';

    // Store-wide computed values (used by all roles)
    const totalDebt     = mockDb.customers.reduce((s, c) => s + (c.outstandingDebt ?? 0), 0);
    const customerDebts = mockDb.customers
      .filter((c) => c.isActive && (c.outstandingDebt ?? 0) > 0)
      .sort((a, b) => (b.outstandingDebt ?? 0) - (a.outstandingDebt ?? 0))
      .map((c) => ({ customerId: c.id, customerName: c.name, outstandingDebt: c.outstandingDebt ?? 0 }));

    if (isOwner) {
      const debtCollected  = mockDb.debtPayments.reduce((s, p) => s + p.amount, 0);
      const prevDayRevenue = mockDb.dashboardStats.weeklyChart[5]?.revenue ?? 0;
      // Compute staff revenue grouped by createdByName
      const staffRevenueMap = new Map<string, StaffRevenueSummary>();
      for (const tx of mockDb.dashboardStats.recentTransactions) {
        if (tx.status !== 'completed') continue;
        const existing = staffRevenueMap.get(tx.createdByName);
        if (existing) {
          staffRevenueMap.set(tx.createdByName, {
            ...existing,
            revenue: existing.revenue + tx.paidAmount,
            transactionCount: existing.transactionCount + 1,
          });
        } else {
          staffRevenueMap.set(tx.createdByName, {
            staffId: tx.createdByName,
            staffName: tx.createdByName,
            revenue: tx.paidAmount,
            transactionCount: 1,
          });
        }
      }
      const staffRevenue = [...staffRevenueMap.values()].sort((a, b) => b.revenue - a.revenue);
      return delay({
        ...mockDb.dashboardStats,
        totalOutstandingDebt: totalDebt,
        todayDebtCollected:   debtCollected,
        previousDayRevenue:   prevDayRevenue,
        customerDebts,
        staffRevenue,
      });
    }

    // Non-owner: scope transaction-derived stats to current user
    const userName    = _user!.name;
    const userTxns    = mockDb.dashboardStats.recentTransactions.filter((tx) => tx.createdByName === userName);
    const completedTx = userTxns.filter((tx) => tx.status === 'completed');
    const todayRevenue      = completedTx.reduce((s, tx) => s + tx.paidAmount, 0);
    const todayTransactions = completedTx.length;
    const todayDebtCollected = (mockDb.debtPayments as Array<{ createdByName: string; amount: number }>)
      .filter((dp) => dp.createdByName === userName)
      .reduce((s, dp) => s + dp.amount, 0);
    // Weekly chart: zero-valued for non-owners (no per-user historical data in mock)
    const zeroWeeklyChart = mockDb.dashboardStats.weeklyChart.map((e) => ({
      ...e, revenue: 0, transactionCount: 0, purchaseCost: 0,
    }));

    return delay({
      ...mockDb.dashboardStats,
      todayRevenue,
      todayTransactions,
      todayPurchaseCost:    0,
      todayDebtCollected,
      previousDayRevenue:   0,
      weeklyChart:          zeroWeeklyChart,
      recentTransactions:   userTxns,
      staffRevenue:         [],
      totalOutstandingDebt: totalDebt,
      customerDebts,
    });
  },
};
