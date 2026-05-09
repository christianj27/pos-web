// import { apiClient } from '../hooks/useApi'; // MOCK MODE
import { mockDb, uid, delay } from '../mocks/db';
import type { Transaction } from '../types';

export interface CreateTransactionPayload {
  type: string;
  customer_id?: string;
  location_id?: string;
  items: { product_id: string; quantity: number; unit_price: number }[];
  paid_amount: number;
  payment_method?: 'cash' | 'transfer' | 'qris';
  notes?: string;
  container_returns?: { product_id: string; quantity: number }[];
  debt_payment_amount?: number;
}

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

export const transactionService = {
  list: (date?: string): Promise<Transaction[]> => {
    // return apiClient.get<Transaction[]>(`/api/transactions${date ? `?date=${date}` : ''}`).then((r) => r.data);
    const all = [...mockDb.transactions].reverse();
    const filtered = date ? all.filter((tx) => toWIBDate(tx.created_at) === date) : all;
    return delay(filtered);
  },

  get: (id: string): Promise<Transaction> => {
    // return apiClient.get<Transaction>(`/api/transactions/${id}`).then((r) => r.data);
    const tx = mockDb.transactions.find((t) => t.id === id)!;
    return delay({ ...tx });
  },

  create: (data: CreateTransactionPayload): Promise<Transaction> => {
    // return apiClient.post<Transaction>('/api/transactions', data).then((r) => r.data);
    const customer = data.customer_id ? mockDb.customers.find((c) => c.id === data.customer_id) : undefined;
    const location = data.location_id ? mockDb.locations.find((l) => l.id === data.location_id) : undefined;
    const items = data.items.map((i) => {
      const prod = mockDb.products.find((p) => p.id === i.product_id);
      return { product_id: i.product_id, product_name: prod?.name ?? '', quantity: i.quantity, unit_price: i.unit_price, subtotal: i.quantity * i.unit_price };
    });
    const total_amount = items.reduce((s, i) => s + i.subtotal, 0);
    const tx: Transaction = {
      id: uid(), type: data.type as Transaction['type'],
      customer_id: customer?.id, customer_name: customer?.name,
      location_id: location?.id, location_name: location?.name,
      items, total_amount, paid_amount: data.paid_amount,
      payment_method: data.payment_method ?? 'cash',
      notes: data.notes,
      status: 'completed',
      created_by_name: 'Demo User', created_at: new Date().toISOString(),
    };
    mockDb.transactions.push(tx);
    // Update customer debt if underpaid
    const debt = total_amount - data.paid_amount;
    if (customer && debt > 0) {
      customer.outstanding_debt = (customer.outstanding_debt ?? 0) + debt;
    }
    // Record ContainerLoans for refillable items (positive = lent) + dispatch StockMovements
    if (customer) {
      data.items.forEach((item) => {
        const prod = mockDb.products.find((p) => p.id === item.product_id);
        if (prod?.category === 'refillable') {
          mockDb.containerLoans.push({
            id: uid(), customer_id: customer.id, customer_name: customer.name ?? '',
            product_id: item.product_id, product_name: prod.name,
            quantity: item.quantity, transaction_id: tx.id,
            created_by_name: 'Demo User', created_at: new Date().toISOString(),
          });
          // Dispatch movement: filled stock leaving the source location
          mockDb.stockMovements.push({
            id: uid(),
            movement_type: 'dispatch',
            product_id: item.product_id, product_name: prod.name,
            from_location_id: tx.location_id ?? '',
            from_location_name: tx.location_name ?? '',
            quantity: item.quantity,
            container_status: 'filled',
            notes: `Penjualan ${tx.id} — ${customer.name}`,
            created_by_name: 'Demo User', created_at: new Date().toISOString(),
          });
        }
      });
      // Record container returns (negative ContainerLoans) + receive StockMovements
      if (data.container_returns) {
        data.container_returns.forEach((ret) => {
          if (ret.quantity > 0) {
            const retProd = mockDb.products.find((p) => p.id === ret.product_id);
            mockDb.containerLoans.push({
              id: uid(), customer_id: customer.id, customer_name: customer.name ?? '',
              product_id: ret.product_id, product_name: retProd?.name ?? '',
              quantity: -ret.quantity, transaction_id: tx.id,
              created_by_name: 'Demo User', created_at: new Date().toISOString(),
            });
            // Receive movement: empty containers arriving at source location
            mockDb.stockMovements.push({
              id: uid(),
              movement_type: 'receive',
              product_id: ret.product_id, product_name: retProd?.name ?? '',
              to_location_id: tx.location_id ?? '',
              to_location_name: tx.location_name ?? '',
              quantity: ret.quantity,
              container_status: 'empty',
              notes: `Kontainer kosong diterima dari ${customer.name} (${tx.id})`,
              created_by_name: 'Demo User', created_at: new Date().toISOString(),
            });
          }
        });
      }
    }
    // Record old debt payment if provided
    if (customer && data.debt_payment_amount && data.debt_payment_amount > 0) {
      mockDb.debtPayments.push({
        id: uid(), customer_id: customer.id, customer_name: customer.name ?? '',
        amount: data.debt_payment_amount, transaction_id: tx.id,
        created_by_name: 'Demo User', created_at: new Date().toISOString(),
      });
      customer.outstanding_debt = Math.max(0, (customer.outstanding_debt ?? 0) - data.debt_payment_amount);
    }
    return delay({ ...tx });
  },

  updateStatus: (id: string, status: string): Promise<void> => {
    // return apiClient.put(`/api/transactions/${id}/status`, { status }).then((r) => r.data);
    const tx = mockDb.transactions.find((t) => t.id === id);
    if (tx && status === 'cancelled') {
      tx.status = 'cancelled';
      // Auto-reverse stock: add compensating StockMovements (receive back to source)
      tx.items.forEach((item) => {
        mockDb.stockMovements.push({
          id: uid(),
          product_id: item.product_id,
          product_name: item.product_name,
          to_location_id: tx.location_id ?? '',
          to_location_name: tx.location_name ?? '',
          movement_type: 'receive',
          quantity: item.quantity,
          notes: `Pembatalan transaksi #${tx.id}`,
          created_by_name: 'System',
          created_at: new Date().toISOString(),
        });
      });
      // Reverse ContainerLoans created for this transaction
      const loansForTx = mockDb.containerLoans.filter((l) => l.transaction_id === id);
      loansForTx.forEach((loan) => {
        mockDb.containerLoans.push({
          id: uid(),
          customer_id: loan.customer_id,
          customer_name: loan.customer_name,
          product_id: loan.product_id,
          product_name: loan.product_name,
          quantity: -loan.quantity,
          transaction_id: tx.id,
          notes: `Pembatalan transaksi #${tx.id}`,
          created_by_name: 'System',
          created_at: new Date().toISOString(),
        });
      });
      // Restore customer debt if paid_amount < total_amount
      const debt = tx.total_amount - tx.paid_amount;
      if (tx.customer_id && debt > 0) {
        const c = mockDb.customers.find((c) => c.id === tx.customer_id);
        if (c) c.outstanding_debt = Math.max(0, (c.outstanding_debt ?? 0) - debt);
      }
    }
    return delay(undefined);
  },

  addPayment: (id: string, amount: number): Promise<void> => {
    // return apiClient.post(`/api/transactions/${id}/payments`, { amount }).then((r) => r.data);
    const tx = mockDb.transactions.find((t) => t.id === id);
    if (tx) {
      tx.paid_amount = Math.min(tx.total_amount, tx.paid_amount + amount);
      if (tx.paid_amount >= tx.total_amount) tx.status = 'completed';
      // Reduce customer debt
      if (tx.customer_id) {
        const c = mockDb.customers.find((c) => c.id === tx.customer_id);
        if (c) c.outstanding_debt = Math.max(0, (c.outstanding_debt ?? 0) - amount);
      }
    }
    return delay(undefined);
  },
};
