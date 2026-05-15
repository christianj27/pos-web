import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { ContainerLoan } from '../types';

export const containerLoanService = {
  list: (customerId?: string): Promise<ContainerLoan[]> => {
    if (!USE_MOCK) {
      const params = customerId ? { customerId } : undefined;
      return apiClient.get<ContainerLoan[]>('/api/container-loans', { params }).then((r) => r.data);
    }
    const loans = customerId
      ? mockDb.containerLoans.filter((l) => l.customerId === customerId)
      : [...mockDb.containerLoans];
    return delay(loans);
  },

  create: (data: { customerId: string; productId: string; quantity: number; notes?: string }): Promise<ContainerLoan> => {
    if (!USE_MOCK) return apiClient.post<ContainerLoan>('/api/container-loans', data).then((r) => r.data);
    const customer = mockDb.customers.find((c) => c.id === data.customerId);
    const product = mockDb.products.find((p) => p.id === data.productId);
    const loan: ContainerLoan = {
      id: uid(), customerId: data.customerId, customerName: customer?.name ?? '',
      productId: data.productId, productName: product?.name ?? '',
      quantity: data.quantity, notes: data.notes,
      createdByName: 'Demo User', createdAt: new Date().toISOString(),
    };
    mockDb.containerLoans.push(loan);
    return delay({ ...loan });
  },
};
