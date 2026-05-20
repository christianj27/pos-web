import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { DebtPayment, CustomerDebtHistory } from '../types';

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

export const debtService = {
  list: (date?: string): Promise<DebtPayment[]> => {
    if (!USE_MOCK) return apiClient.get<DebtPayment[]>(`/api/debt-payments${date ? `?date=${date}` : ''}`).then((r) => r.data);
    const all = [...mockDb.debtPayments].reverse();
    const filtered = date ? all.filter((p) => toWIBDate(p.createdAt) === date) : all;
    return delay(filtered);
  },

  create: (data: { customerId: string; amount: number; method: 'cash' | 'transfer' | 'qris'; referenceNo?: string; note?: string }): Promise<DebtPayment> => {
    if (!USE_MOCK) return apiClient.post<DebtPayment>('/api/debt-payments', data).then((r) => r.data);
    const customer = mockDb.customers.find((c) => c.id === data.customerId);
    const payment: DebtPayment = {
      id: uid(), customerId: data.customerId, customerName: customer?.name ?? '',
      amount: data.amount, method: data.method, referenceNo: data.referenceNo, note: data.note,
      createdByName: 'Demo User', createdAt: new Date().toISOString(),
    };
    mockDb.debtPayments.push(payment);
    // Reduce customer outstanding debt
    if (customer) customer.outstandingDebt = Math.max(0, (customer.outstandingDebt ?? 0) - data.amount);
    return delay({ ...payment });
  },

  getCustomerHistory: (customerId: string): Promise<CustomerDebtHistory> => {
    if (!USE_MOCK) return apiClient.get<CustomerDebtHistory>(`/api/customers/${customerId}/debt-history`).then((r) => r.data);
    const customer = mockDb.customers.find((c) => c.id === customerId);
    // Transactions that created debt for this customer
    const debtTransactions = mockDb.transactions
      .filter((tx) => tx.customerId === customerId && tx.totalAmount > tx.paidAmount && tx.status !== 'cancelled')
      .map((tx) => ({
        id: tx.id,
        createdAt: tx.createdAt,
        type: tx.transactionType,
        totalAmount: tx.totalAmount,
        paidAmount: tx.paidAmount,
        debtAmount: tx.totalAmount - tx.paidAmount,
        createdByName: tx.staffName,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Standalone debt payments for this customer
    const payments = mockDb.debtPayments
      .filter((p) => p.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return delay({
      customerId,
      customerName: customer?.name ?? '',
      initialDebt: customer?.initialDebt ?? 0,
      outstandingDebt: customer?.outstandingDebt ?? 0,
      debtTransactions,
      payments: [...payments],
    });
  },
};
