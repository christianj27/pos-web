import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { Customer, CustomerPricingItem } from '../types';

export const customerService = {
  list: (role?: string): Promise<Customer[]> =>
    USE_MOCK
      ? delay(mockDb.customers.filter((c) => role === 'owner' || !c.isConfidential))
      : apiClient.get<Customer[]>('/api/customers').then((r) => r.data),

  create: (data: { name: string; phone?: string; address?: string; initialDebt?: number; isConfidential?: boolean }): Promise<Customer> => {
    if (!USE_MOCK) return apiClient.post<Customer>('/api/customers', data).then((r) => r.data);
    const c: Customer = { id: uid(), name: data.name, phone: data.phone, address: data.address, isActive: true, isConfidential: data.isConfidential ?? false, outstandingDebt: data.initialDebt ?? 0, initialDebt: data.initialDebt ?? 0, createdAt: new Date().toISOString() };
    mockDb.customers.push(c);
    return delay({ ...c });
  },

  update: (id: string, data: { name?: string; phone?: string; address?: string; isActive?: boolean; initialDebt?: number; isConfidential?: boolean }): Promise<Customer> => {
    if (!USE_MOCK) return apiClient.put<Customer>(`/api/customers/${id}`, data).then((r) => r.data);
    const idx = mockDb.customers.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const oldInitialDebt = mockDb.customers[idx].initialDebt ?? 0;
      Object.assign(mockDb.customers[idx], data);
      if (data.initialDebt != null) {
        mockDb.customers[idx].outstandingDebt = (mockDb.customers[idx].outstandingDebt ?? 0) + (data.initialDebt - oldInitialDebt);
      }
    }
    return delay({ ...mockDb.customers[idx] });
  },

  deactivate: (id: string, data: { name?: string; phone?: string; address?: string; isActive?: boolean }): Promise<void> => {
    if (!USE_MOCK) return apiClient.put(`/api/customers/${id}`, data).then((r) => r.data);
    const c = mockDb.customers.find((c) => c.id === id);
    if (c) c.isActive = false;
    return delay(undefined);
  },

  reactivate: (id: string, data: { name?: string; phone?: string; address?: string; isActive?: boolean }): Promise<void> => {
    if (!USE_MOCK) return apiClient.put(`/api/customers/${id}`, data).then((r) => r.data);
    const c = mockDb.customers.find((c) => c.id === id);
    if (c) c.isActive = true;
    return delay(undefined);
  },

  getPricing: (id: string): Promise<CustomerPricingItem[]> => {
    if (!USE_MOCK) return apiClient.get<CustomerPricingItem[]>(`/api/customers/${id}/pricing`).then((r) => r.data);
    const pricing = mockDb.customerPricing[id];
    if (pricing) return delay([...pricing]);
    // Return all active products with no custom price for customers without saved pricing
    const items: CustomerPricingItem[] = mockDb.products
      .filter((p) => p.isActive)
      .map((p) => ({ productId: p.id, productName: p.name, basePrice: p.basePrice, customPrice: undefined }));
    return delay(items);
  },

  updatePricing: (id: string, items: { productId: string; customPrice?: number }[]): Promise<void> => {
    if (!USE_MOCK) return apiClient.put(`/api/customers/${id}/pricing`, { items }).then((r) => r.data);
    const existing = mockDb.customerPricing[id] ?? [];
    items.forEach(({ productId, customPrice }) => {
      const row = existing.find((r) => r.productId === productId);
      if (row) row.customPrice = customPrice;
    });
    mockDb.customerPricing[id] = existing;
    return delay(undefined);
  },

  getDebt: (id: string): Promise<{ outstandingDebt: number }> => {
    if (!USE_MOCK) return apiClient.get<{ outstandingDebt: number }>(`/api/customers/${id}/debt`).then((r) => r.data);
    const c = mockDb.customers.find((c) => c.id === id);
    return delay({ outstandingDebt: c?.outstandingDebt ?? 0 });
  },

  getContainerLoans: (id: string) => {
    if (!USE_MOCK) return apiClient.get(`/api/customers/${id}/container-loans`).then((r) => r.data);
    return delay(mockDb.containerLoans.filter((l) => l.customerId === id));
  },
};
