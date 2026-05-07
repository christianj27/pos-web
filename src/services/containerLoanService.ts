// import { apiClient } from '../hooks/useApi'; // MOCK MODE
import { mockDb, uid, delay } from '../mocks/db';
import type { ContainerLoan } from '../types';

export const containerLoanService = {
  list: (customerId?: string): Promise<ContainerLoan[]> => {
    // const params = customerId ? { customer_id: customerId } : undefined;
    // return apiClient.get<ContainerLoan[]>('/api/container-loans', { params }).then((r) => r.data);
    const loans = customerId
      ? mockDb.containerLoans.filter((l) => l.customer_id === customerId)
      : [...mockDb.containerLoans];
    return delay(loans);
  },

  create: (data: { customer_id: string; product_id: string; quantity: number; notes?: string }): Promise<ContainerLoan> => {
    // return apiClient.post<ContainerLoan>('/api/container-loans', data).then((r) => r.data);
    const customer = mockDb.customers.find((c) => c.id === data.customer_id);
    const product = mockDb.products.find((p) => p.id === data.product_id);
    const loan: ContainerLoan = {
      id: uid(), customer_id: data.customer_id, customer_name: customer?.name ?? '',
      product_id: data.product_id, product_name: product?.name ?? '',
      quantity: data.quantity, notes: data.notes,
      created_by_name: 'Demo User', created_at: new Date().toISOString(),
    };
    mockDb.containerLoans.push(loan);
    return delay({ ...loan });
  },
};
