// import { apiClient } from '../hooks/useApi'; // MOCK MODE
import { mockDb, uid, delay } from '../mocks/db';
import type { DebtPayment, CustomerDebtHistory } from '../types';

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

export const debtService = {
  list: (date?: string): Promise<DebtPayment[]> => {
    // return apiClient.get<DebtPayment[]>(`/api/debt-payments${date ? `?date=${date}` : ''}`).then((r) => r.data);
    const all = [...mockDb.debtPayments].reverse();
    const filtered = date ? all.filter((p) => toWIBDate(p.created_at) === date) : all;
    return delay(filtered);
  },

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

  getCustomerHistory: (customerId: string): Promise<CustomerDebtHistory> => {
    // return apiClient.get<CustomerDebtHistory>(`/api/customers/${customerId}/debt-history`).then((r) => r.data);
    const customer = mockDb.customers.find((c) => c.id === customerId);
    // Transactions that created debt for this customer
    const debtTransactions = mockDb.transactions
      .filter((tx) => tx.customer_id === customerId && tx.total_amount > tx.paid_amount && tx.status !== 'cancelled')
      .map((tx) => ({
        id: tx.id,
        created_at: tx.created_at,
        type: tx.type,
        total_amount: tx.total_amount,
        paid_amount: tx.paid_amount,
        debt_amount: tx.total_amount - tx.paid_amount,
        created_by_name: tx.created_by_name,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Standalone debt payments for this customer
    const payments = mockDb.debtPayments
      .filter((p) => p.customer_id === customerId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return delay({
      customer_id: customerId,
      customer_name: customer?.name ?? '',
      outstanding_debt: customer?.outstanding_debt ?? 0,
      debt_transactions: debtTransactions,
      payments: [...payments],
    });
  },
};
