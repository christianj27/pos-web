// import { apiClient } from '../hooks/useApi'; // MOCK MODE
import { mockDb, uid, delay } from '../mocks/db';
import type { DebtPayment } from '../types';

export const debtService = {
  list: (): Promise<DebtPayment[]> =>
    // apiClient.get<DebtPayment[]>('/api/debt-payments').then((r) => r.data),
    delay([...mockDb.debtPayments].reverse()),

  create: (data: { customer_id: string; amount: number; notes?: string }): Promise<DebtPayment> => {
    // return apiClient.post<DebtPayment>('/api/debt-payments', data).then((r) => r.data);
    const customer = mockDb.customers.find((c) => c.id === data.customer_id);
    const payment: DebtPayment = {
      id: uid(), customer_id: data.customer_id, customer_name: customer?.name ?? '',
      amount: data.amount, notes: data.notes,
      created_by_name: 'Demo User', created_at: new Date().toISOString(),
    };
    mockDb.debtPayments.push(payment);
    // Reduce customer outstanding debt
    if (customer) customer.outstanding_debt = Math.max(0, (customer.outstanding_debt ?? 0) - data.amount);
    return delay({ ...payment });
  },
};
