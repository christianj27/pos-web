import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, delay } from '../mocks/db';
import { resolveStockPeriodRange, todayWIB } from '../utils/stockPeriod';
import type { AuthUser, DashboardStats, StockProductSummary, ContainerLoanSummaryItem, StaffRevenueSummary, PaymentMethodBreakdownItem, PaymentMethodStaffItem, StockMovementSummaryResponse, StockPeriod } from '../types';

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

/** Mock equivalent of GET /api/dashboard/stock-summary — inclusive WIB range, store-wide (FR-DSH-012). */
function computeStockSummary(startDate: string, endDate: string): StockProductSummary[] {
  const filtered = mockDb.stockMovements.filter((m) => {
    if (m.isReversed || m.isReversal) return false;
    const day = toWIBDate(m.createdAt);
    return day >= startDate && day <= endDate;
  });

  const byProduct = new Map<string, typeof filtered>();
  for (const m of filtered) {
    if (!byProduct.has(m.productId)) byProduct.set(m.productId, []);
    byProduct.get(m.productId)!.push(m);
  }

  const result: StockProductSummary[] = [];
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

// Net container balance per customer + product (FR-DSH-014) — store-wide, active customers only, net != 0 only.
function computeContainerLoanSummary(): ContainerLoanSummaryItem[] {
  const activeCustomerIds = new Set(mockDb.customers.filter((c) => c.isActive).map((c) => c.id));

  const netMap = new Map<string, ContainerLoanSummaryItem>();
  for (const loan of mockDb.containerLoans) {
    if (!activeCustomerIds.has(loan.customerId)) continue;
    const key = `${loan.customerId}__${loan.productId}`;
    if (!netMap.has(key)) {
      const product = mockDb.products.find((p) => p.id === loan.productId);
      netMap.set(key, {
        customerId:   loan.customerId,
        customerName: loan.customerName ?? loan.customerId,
        productId:    loan.productId,
        productName:  loan.productName ?? loan.productId,
        productUnit:  product?.unit ?? '',
        netQuantity:  0,
      });
    }
    netMap.get(key)!.netQuantity += loan.quantity;
  }

  return [...netMap.values()]
    .filter((e) => e.netQuantity !== 0)
    .sort((a, b) =>
      a.customerName.localeCompare(b.customerName) ||
      Math.abs(b.netQuantity) - Math.abs(a.netQuantity) ||
      a.productName.localeCompare(b.productName),
    );
}

function computePaymentMethodBreakdown(
  transactions: Array<{ paymentMethod: string | undefined; paidAmount: number; createdByName: string }>,
  includeStaff: boolean,
): PaymentMethodBreakdownItem[] {
  const methodCounts = new Map<string, { amount: number; count: number }>();
  const methodStaff = new Map<string, Map<string, { amount: number; count: number }>>();

  for (const tx of transactions) {
    const method = tx.paymentMethod?.toLowerCase() || 'unknown';
    const existing = methodCounts.get(method) || { amount: 0, count: 0 };
    methodCounts.set(method, {
      amount: existing.amount + tx.paidAmount,
      count: existing.count + 1,
    });

    if (!includeStaff) continue;

    // Group per staff member — mirrors the backend's GroupBy(PaymentMethod, StaffId)
    const staffMap = methodStaff.get(method) ?? new Map<string, { amount: number; count: number }>();
    const staffName = tx.createdByName || 'Unknown';
    const staffExisting = staffMap.get(staffName) || { amount: 0, count: 0 };
    staffMap.set(staffName, {
      amount: staffExisting.amount + tx.paidAmount,
      count: staffExisting.count + 1,
    });
    methodStaff.set(method, staffMap);
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
    const staffMap = methodStaff.get(method);
    const staffRows: PaymentMethodStaffItem[] = staffMap
      ? [...staffMap.entries()]
          .map(([staffName, v]) => ({
            staffId: staffName,
            staffName,
            amount: v.amount,
            count: v.count,
          }))
          .sort((a, b) => b.amount - a.amount || a.staffName.localeCompare(b.staffName))
      : [];

    result.push({
      method,
      label: methodLabels[method] || method,
      amount: data.amount,
      count: data.count,
      staff: includeStaff ? staffRows : [],
    });
  }

  return result;
}

export interface StockSummaryQuery {
  period: StockPeriod;
  /** Anchor date for day/week/month/year (YYYY-MM-DD); ignored for a custom range. */
  date?: string;
  /** Required when `period === 'custom'` (YYYY-MM-DD). */
  startDate?: string;
  endDate?: string;
}

export const dashboardService = {
  /**
   * FR-DSH-012 — "Pergerakan Stok" summary for the section's own period selector.
   * Deliberately separate from `getStats`: changing the period never refetches (or alters) the
   * other dashboard sections, and the 5s dashboard poll never re-runs this query.
   */
  getStockSummary: (query: StockSummaryQuery): Promise<StockMovementSummaryResponse> => {
    if (!USE_MOCK) {
      const params = new URLSearchParams({ period: query.period });
      if (query.period === 'custom') {
        params.set('start_date', query.startDate ?? '');
        params.set('end_date', query.endDate ?? '');
      } else {
        params.set('date', query.date ?? todayWIB());
      }
      return apiClient
        .get<StockMovementSummaryResponse>(`/api/dashboard/stock-summary?${params.toString()}`)
        .then((r) => r.data);
    }

    const range = resolveStockPeriodRange(query.period, query.date ?? todayWIB(), query.startDate, query.endDate);
    return delay({
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
      items: computeStockSummary(range.startDate, range.endDate),
    });
  },

  getStats: (_date?: string, _user?: AuthUser | null): Promise<DashboardStats> => {
    if (!USE_MOCK) return apiClient.get<DashboardStats>(`/api/dashboard${_date ? `?date=${_date}` : ''}`).then((r) => r.data);

    const isOwner = !_user || _user.role === 'owner';

    // Store-wide computed values (used by all roles)
    const totalDebt     = mockDb.customers.filter((c) => c.isActive).reduce((s, c) => s + (c.outstandingDebt ?? 0), 0);
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
        .map((tx) => ({ paymentMethod: tx.paymentMethod, paidAmount: tx.paidAmount, createdByName: tx.createdByName }));
      const paymentBreakdown = computePaymentMethodBreakdown(completedTxns, true);
      // The headline card and the payment-method breakdown must agree: both derive from the same
      // completed-transaction seed, otherwise the modal amounts would not add up to the card total.
      const todayRevenue      = completedTxns.reduce((s, tx) => s + tx.paidAmount, 0);
      const todayTransactions = completedTxns.length;
      return delay({
        ...mockDb.dashboardStats,
        todayRevenue,
        todayTransactions,
        totalOutstandingDebt: totalDebt,
        todayDebtCollected:   debtCollected,
        previousDayRevenue:   prevDayRevenue,
        customerDebts,
        containerLoans: computeContainerLoanSummary(),
        staffRevenue,
        paymentMethodBreakdown: paymentBreakdown,
      });
    }

    // Non-owner: scope transaction-derived stats to current user
    const userName    = _user!.name;
    const userTxns    = mockDb.dashboardStats.recentTransactions.filter((tx) => tx.createdByName === userName);
    const completedTx = userTxns.filter((tx) => tx.status === 'completed').map((tx) => ({ paymentMethod: tx.paymentMethod, paidAmount: tx.paidAmount, createdByName: tx.createdByName }));
    const todayRevenue      = completedTx.reduce((s, tx) => s + tx.paidAmount, 0);
    const todayTransactions = completedTx.length;
    const todayDebtCollected = (mockDb.debtPayments as Array<{ createdByName: string; amount: number }>)
      .filter((dp) => dp.createdByName === userName)
      .reduce((s, dp) => s + dp.amount, 0);
    // Weekly chart: zero-valued for non-owners (no per-user historical data in mock)
    const zeroWeeklyChart = mockDb.dashboardStats.weeklyChart.map((e) => ({
      ...e, revenue: 0, transactionCount: 0, purchaseCost: 0,
    }));
    // Payment breakdown for non-owner's own transactions (no per-staff list — owner only)
    const userPaymentBreakdown = computePaymentMethodBreakdown(completedTx, false);

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
      containerLoans: computeContainerLoanSummary(),
      paymentMethodBreakdown: userPaymentBreakdown,
    });
  },
};
