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

    // 1. Transactions → cash_in (paid_amount) + new_debt (unpaid remainder)
    for (const tx of mockDb.transactions) {
      if (tx.status === 'cancelled') continue;
      if (date && toWIBDate(tx.created_at) !== date) continue;

      const customerLabel = tx.customer_name ? ` — ${tx.customer_name}` : '';
      const typeLabel = tx.transaction_type === 'delivery' ? 'Pengiriman' : 'Kasir';

      if (tx.paid_amount > 0) {
        entries.push({
          id: `${tx.id}-cash`,
          flow_type: 'cash_in',
          category: 'sale_payment',
          amount: tx.paid_amount,
          description: `${typeLabel}${customerLabel}`,
          reference_id: tx.id,
          created_by_name: tx.staff_name,
          created_at: tx.created_at,
        });
      }

      const debtAmount = tx.total_amount - tx.paid_amount;
      if (debtAmount > 0) {
        entries.push({
          id: `${tx.id}-debt`,
          flow_type: 'new_debt',
          category: 'debt_created',
          amount: debtAmount,
          description: `Piutang Baru — ${tx.customer_name ?? 'Pelanggan'}`,
          reference_id: tx.id,
          created_by_name: tx.staff_name,
          created_at: tx.created_at,
        });
      }
    }

    // 2. Standalone debt payments → cash_in
    for (const p of mockDb.debtPayments) {
      if (date && toWIBDate(p.created_at) !== date) continue;
      entries.push({
        id: `dp-${p.id}`,
        flow_type: 'cash_in',
        category: 'debt_payment',
        amount: p.amount,
        description: `Bayar Hutang — ${p.customer_name}`,
        reference_id: p.id,
        created_by_name: p.created_by_name,
        created_at: p.created_at,
      });
    }

    // 3. Stock movements with purchase_cost → cash_out
    for (const m of mockDb.stockMovements) {
      if (!m.purchase_cost || m.purchase_cost <= 0) continue;
      if (date && toWIBDate(m.created_at) !== date) continue;
      const typeLabel = m.movement_type === 'production' ? 'Produksi' : 'Beli Stok';
      entries.push({
        id: `sm-${m.id}`,
        flow_type: 'cash_out',
        category: 'stock_purchase',
        amount: m.purchase_cost,
        description: `${typeLabel} — ${m.product_name}`,
        reference_id: m.id,
        created_by_name: m.created_by_name,
        created_at: m.created_at,
      });
    }

    // Sort newest first
    entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total_cash_in  = entries.filter((e) => e.flow_type === 'cash_in').reduce((s, e) => s + e.amount, 0);
    const total_cash_out = entries.filter((e) => e.flow_type === 'cash_out').reduce((s, e) => s + e.amount, 0);
    const total_new_debt = entries.filter((e) => e.flow_type === 'new_debt').reduce((s, e) => s + e.amount, 0);

    return delay({
      total_cash_in,
      total_cash_out,
      net_cash: total_cash_in - total_cash_out,
      total_new_debt,
      entries,
    });
  },
};
