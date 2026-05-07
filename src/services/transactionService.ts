// import { apiClient } from '../hooks/useApi'; // MOCK MODE
import { mockDb, uid, delay } from '../mocks/db';
import type { Transaction } from '../types';

export interface CreateTransactionPayload {
  type: string;
  customer_id?: string;
  location_id?: string;
  items: { product_id: string; quantity: number; unit_price: number }[];
  paid_amount: number;
}

export const transactionService = {
  list: (): Promise<Transaction[]> =>
    // apiClient.get<Transaction[]>('/api/transactions').then((r) => r.data),
    delay([...mockDb.transactions].reverse()),

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
      status: data.paid_amount >= total_amount ? 'completed' : 'pending',
      created_by_name: 'Demo User', created_at: new Date().toISOString(),
    };
    mockDb.transactions.push(tx);
    // Update customer debt if underpaid
    if (customer && data.paid_amount < total_amount) {
      customer.outstanding_debt = (customer.outstanding_debt ?? 0) + (total_amount - data.paid_amount);
    }
    return delay({ ...tx });
  },

  updateStatus: (id: string, status: string): Promise<void> => {
    // return apiClient.put(`/api/transactions/${id}/status`, { status }).then((r) => r.data);
    const tx = mockDb.transactions.find((t) => t.id === id);
    if (tx) tx.status = status as Transaction['status'];
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
