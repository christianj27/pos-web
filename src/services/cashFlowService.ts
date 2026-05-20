import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, delay } from '../mocks/db';
import type { CashFlowEntry, CashFlowSummary } from '../types';

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

export const cashFlowService = {
  getSummary: (date?: string): Promise<CashFlowSummary> => {
    if (!USE_MOCK) return apiClient.get<CashFlowSummary>(`/api/cash-flow${date ? `?date=${date}` : ''}`).then((r) => r.data);
    const entries: CashFlowEntry[] = [];

    // 1. Transactions → cash_in (paidAmount) + new_debt (unpaid remainder)
    for (const tx of mockDb.transactions) {
      if (tx.status === 'cancelled') continue;
      if (date && toWIBDate(tx.createdAt) !== date) continue;

      const customerLabel = tx.customerName ? ` — ${tx.customerName}` : '';
      const typeLabel = tx.transactionType === 'delivery' ? 'Pengiriman' : 'Kasir';

      if (tx.paidAmount > 0) {
        entries.push({
          index: `${tx.id}-cash`,
          id: `${tx.id}-cash`,
          flowType: 'cash_in',
          category: 'sale_payment',
          amount: tx.paidAmount,
          description: `${typeLabel}${customerLabel}`,
          referenceId: tx.id,
          createdByName: tx.staffName,
          createdAt: tx.createdAt,
        });
      }

      const debtAmount = tx.totalAmount - tx.paidAmount;
      if (debtAmount > 0) {
        entries.push({
          index: `${tx.id}-debt`,
          id: `${tx.id}-debt`,
          flowType: 'new_debt',
          category: 'debt_created',
          amount: debtAmount,
          description: `Piutang Baru — ${tx.customerName ?? 'Pelanggan'}`,
          referenceId: tx.id,
          createdByName: tx.staffName,
          createdAt: tx.createdAt,
        });
      }
    }

    // 2. Standalone debt payments → cash_in
    for (const p of mockDb.debtPayments) {
      if (date && toWIBDate(p.createdAt) !== date) continue;
      entries.push({
        index: `dp-${p.id}`,
        id: `dp-${p.id}`,
        flowType: 'cash_in',
        category: 'debt_payment',
        amount: p.amount,
        description: `Bayar Hutang — ${p.customerName}`,
        referenceId: p.id,
        createdByName: p.createdByName,
        createdAt: p.createdAt,
      });
    }

    // 3. Stock movements with purchaseCost → cash_out
    for (const m of mockDb.stockMovements) {
      if (!m.purchaseCost || m.purchaseCost <= 0) continue;
      if (date && toWIBDate(m.createdAt) !== date) continue;
      const typeLabel = m.movementType === 'production' ? 'Produksi' : 'Beli Stok';
      entries.push({
        index: `sm-${m.id}`,
        id: `sm-${m.id}`,
        flowType: 'cash_out',
        category: 'stock_purchase',
        amount: m.purchaseCost,
        description: `${typeLabel} — ${m.productName}`,
        referenceId: m.id,
        createdByName: m.createdByName,
        createdAt: m.createdAt,
      });
    }

    // Sort newest first
    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalCashIn  = entries.filter((e) => e.flowType === 'cash_in').reduce((s, e) => s + e.amount, 0);
    const totalCashOut = entries.filter((e) => e.flowType === 'cash_out').reduce((s, e) => s + e.amount, 0);
    const totalNewDebt = entries.filter((e) => e.flowType === 'new_debt').reduce((s, e) => s + e.amount, 0);

    return delay({
      totalCashIn,
      totalCashOut,
      netCash: totalCashIn - totalCashOut,
      totalNewDebt,
      entries,
    });
  },

  getRange: (startDate: string, endDate: string): Promise<CashFlowSummary> => {
    if (!USE_MOCK) {
      return apiClient
        .get<CashFlowSummary>(`/api/cash-flow?start_date=${startDate}&end_date=${endDate}`)
        .then((r) => r.data);
    }

    // Mock: collect all entries within the date range
    const entries: CashFlowEntry[] = [];

    for (const tx of mockDb.transactions) {
      if (tx.status === 'cancelled') continue;
      const d = toWIBDate(tx.createdAt);
      if (d < startDate || d > endDate) continue;

      const customerLabel = tx.customerName ? ` — ${tx.customerName}` : '';
      const typeLabel = tx.transactionType === 'delivery' ? 'Pengiriman' : 'Kasir';

      if (tx.paidAmount > 0) {
        entries.push({
          index: `${tx.id}-cash`,
          id: `${tx.id}-cash`,
          flowType: 'cash_in',
          category: 'sale_payment',
          amount: tx.paidAmount,
          description: `${typeLabel}${customerLabel}`,
          referenceId: tx.id,
          createdByName: tx.staffName,
          createdAt: tx.createdAt,
        });
      }
      const debtAmount = tx.totalAmount - tx.paidAmount;
      if (debtAmount > 0) {
        entries.push({
          index: `${tx.id}-debt`,
          id: `${tx.id}-debt`,
          flowType: 'new_debt',
          category: 'debt_created',
          amount: debtAmount,
          description: `Piutang Baru — ${tx.customerName ?? 'Pelanggan'}`,
          referenceId: tx.id,
          createdByName: tx.staffName,
          createdAt: tx.createdAt,
        });
      }
    }

    for (const p of mockDb.debtPayments) {
      const d = toWIBDate(p.createdAt);
      if (d < startDate || d > endDate) continue;
      entries.push({
        index: `dp-${p.id}`,
        id: `dp-${p.id}`,
        flowType: 'cash_in',
        category: 'debt_payment',
        amount: p.amount,
        description: `Bayar Hutang — ${p.customerName}`,
        referenceId: p.id,
        createdByName: p.createdByName,
        createdAt: p.createdAt,
      });
    }

    for (const m of mockDb.stockMovements) {
      if (!m.purchaseCost || m.purchaseCost <= 0) continue;
      const d = toWIBDate(m.createdAt);
      if (d < startDate || d > endDate) continue;
      const typeLabel = m.movementType === 'production' ? 'Produksi' : 'Beli Stok';
      entries.push({
        index: `sm-${m.id}`,
        id: `sm-${m.id}`,
        flowType: 'cash_out',
        category: 'stock_purchase',
        amount: m.purchaseCost,
        description: `${typeLabel} — ${m.productName}`,
        referenceId: m.id,
        createdByName: m.createdByName,
        createdAt: m.createdAt,
      });
    }

    entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalCashIn  = entries.filter((e) => e.flowType === 'cash_in').reduce((s, e) => s + e.amount, 0);
    const totalCashOut = entries.filter((e) => e.flowType === 'cash_out').reduce((s, e) => s + e.amount, 0);
    const totalNewDebt = entries.filter((e) => e.flowType === 'new_debt').reduce((s, e) => s + e.amount, 0);

    return delay({
      totalCashIn,
      totalCashOut,
      netCash: totalCashIn - totalCashOut,
      totalNewDebt,
      entries,
    });
  },
};
