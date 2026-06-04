import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, delay } from '../mocks/db';
import type { AuthUser, DashboardStats, DailyStockProductSummary, StaffRevenueSummary, PaymentMethodBreakdownItem } from '../types';

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

    const totalSold = isRefillable
      ? movements.filter((m) => m.movementType === 'dispatch' && m.containerStatus === 'filled')
                 .reduce((s, m) => s + m.quantity, 0)
      : movements.filter((m) => m.movementType === 'dispatch')
                 .reduce((s, m) => s + m.quantity, 0);

    const totalReceived = isRefillable
      ? movements.filter((m) => m.toLocationId != null && m.fromLocationId == null && m.containerStatus === 'filled')
                 .reduce((s, m) => s + m.quantity, 0)
      : movements.filter((m) => m.toLocationId != null && m.fromLocationId == null)
                 .reduce((s, m) => s + m.quantity, 0);

    if (totalSold === 0 && totalReceived === 0) continue;

    result.push({
      productId:       first.productId,
      productName:     first.productName,
      productUnit:     prod?.unit ?? '',
      productCategory: prod?.category ?? 'simple',
      totalSold,
      totalReceived,
    });
  }

  result.sort((a, b) => a.productName.localeCompare(b.productName));
  return result;
}

function computePaymentMethodBreakdown(transactions: Array<{ paymentMethod: string | undefined; paidAmount: number }>): PaymentMethodBreakdownItem[] {
  const methodCounts = new Map<string, { amount: number; count: number }>();

  for (const tx of transactions) {
    const method = tx.paymentMethod?.toLowerCase() || 'unknown';
    const existing = methodCounts.get(method) || { amount: 0, count: 0 };
    methodCounts.set(method, {
      amount: existing.amount + tx.paidAmount,
      count: existing.count + 1,
    });
  }

  const methodLabels: Record<string, string> = {
    cash: 'Tunai',
    transfer: 'Transfer',
    qris: 'QRIS',
  };

  // Order: cash, transfer, qris
  const result: PaymentMethodBreakdownItem[] = [];
  for (const method of ['cash', 'transfer', 'qris']) {
    const data = methodCounts.get(method) || { amount: 0, count: 0 };
    result.push({
      method,
      label: methodLabels[method] || method,
      amount: data.amount,
      count: data.count,
    });
  }

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
      const completedTxns = mockDb.dashboardStats.recentTransactions
        .filter((tx) => tx.status === 'completed')
        .map((tx) => ({ paymentMethod: tx.paymentMethod, paidAmount: tx.paidAmount }));
      const paymentBreakdown = computePaymentMethodBreakdown(completedTxns);
      return delay({
        ...mockDb.dashboardStats,
        totalOutstandingDebt: totalDebt,
        todayDebtCollected:   debtCollected,
        previousDayRevenue:   prevDayRevenue,
        customerDebts,
        staffRevenue,
        dailyStockSummary: computeDailyStockSummary(_date),
        paymentMethodBreakdown: paymentBreakdown,
      });
    }

    // Non-owner: scope transaction-derived stats to current user
    const userName    = _user!.name;
    const userTxns    = mockDb.dashboardStats.recentTransactions.filter((tx) => tx.createdByName === userName);
    const completedTx = userTxns.filter((tx) => tx.status === 'completed').map((tx) => ({ paymentMethod: tx.paymentMethod, paidAmount: tx.paidAmount }));
    const todayRevenue      = completedTx.reduce((s, tx) => s + tx.paidAmount, 0);
    const todayTransactions = completedTx.length;
    const todayDebtCollected = (mockDb.debtPayments as Array<{ createdByName: string; amount: number }>)
      .filter((dp) => dp.createdByName === userName)
      .reduce((s, dp) => s + dp.amount, 0);
    // Weekly chart: zero-valued for non-owners (no per-user historical data in mock)
    const zeroWeeklyChart = mockDb.dashboardStats.weeklyChart.map((e) => ({
      ...e, revenue: 0, transactionCount: 0, purchaseCost: 0,
    }));
    // Payment breakdown for non-owner's own transactions
    const userPaymentBreakdown = computePaymentMethodBreakdown(completedTx);

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
      paymentMethodBreakdown: userPaymentBreakdown,
    });
  },
};
