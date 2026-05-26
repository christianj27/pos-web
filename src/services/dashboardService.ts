import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, delay } from '../mocks/db';
import type { AuthUser, DashboardStats, DailyMovementBreakdownItem, DailyStockProductSummary, StaffRevenueSummary } from '../types';

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

function computeDailyStockSummary(date?: string): DailyStockProductSummary[] {
  const filtered = mockDb.stockMovements.filter(
    (m) => (!date || toWIBDate(m.createdAt) === date) && !m.isReversed && !m.isReversal,
  );

  const byProduct = new Map<string, typeof filtered>();
  for (const m of filtered) {
    if (!byProduct.has(m.productId)) byProduct.set(m.productId, []);
    byProduct.get(m.productId)!.push(m);
  }

  const result: DailyStockProductSummary[] = [];
  for (const movements of byProduct.values()) {
    const first = movements[0];
    const prod  = mockDb.products.find((p) => p.id === first.productId);
    const isRefillable = prod?.category === 'refillable';

    const byTypeMap = new Map<string, DailyMovementBreakdownItem>();
    for (const m of movements) {
      const type = m.movementType;
      if (!byTypeMap.has(type))
        byTypeMap.set(type, { movementType: type, filledDelta: 0, emptyDelta: 0, simpleDelta: 0 });
      const item = byTypeMap.get(type)!;

      if (m.movementType === 'production') {
        item.filledDelta += m.quantity;
        item.emptyDelta  -= m.quantity;
      } else {
        const isIn  = m.toLocationId   != null && m.fromLocationId == null;
        const isOut = m.fromLocationId != null && m.toLocationId   == null;
        const dir   = isIn ? 1 : isOut ? -1 : 0;
        if (isRefillable) {
          if (m.containerStatus === 'filled')      item.filledDelta += dir * m.quantity;
          else if (m.containerStatus === 'empty')  item.emptyDelta  += dir * m.quantity;
        } else {
          item.simpleDelta += dir * m.quantity;
        }
      }
    }

    const breakdown = [...byTypeMap.values()];
    result.push({
      productId:      first.productId,
      productName:    first.productName,
      productUnit:    prod?.unit ?? '',
      productCategory: prod?.category ?? 'simple',
      netFilledDelta: breakdown.reduce((s, t) => s + t.filledDelta, 0),
      netEmptyDelta:  breakdown.reduce((s, t) => s + t.emptyDelta,  0),
      netSimpleDelta: breakdown.reduce((s, t) => s + t.simpleDelta, 0),
      breakdown,
    });
  }

  result.sort((a, b) => a.productName.localeCompare(b.productName));
  return result;
}

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
        dailyStockSummary: computeDailyStockSummary(_date),
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
      dailyStockSummary: computeDailyStockSummary(_date),
    });
  },
};
