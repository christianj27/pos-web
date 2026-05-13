import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { Customer, CustomerPricingItem } from '../types';

export const customerService = {
  list: (): Promise<Customer[]> =>
    USE_MOCK ? delay([...mockDb.customers]) : apiClient.get<Customer[]>('/api/customers').then((r) => r.data),

  create: (data: { name: string; phone?: string; address?: string }): Promise<Customer> => {
    if (!USE_MOCK) return apiClient.post<Customer>('/api/customers', data).then((r) => r.data);
    const c: Customer = { id: uid(), name: data.name, phone: data.phone, address: data.address, is_active: true, outstanding_debt: 0, created_at: new Date().toISOString() };
    mockDb.customers.push(c);
    return delay({ ...c });
  },

  update: (id: string, data: { name?: string; phone?: string; address?: string }): Promise<Customer> => {
    if (!USE_MOCK) return apiClient.put<Customer>(`/api/customers/${id}`, data).then((r) => r.data);
    const idx = mockDb.customers.findIndex((c) => c.id === id);
    if (idx !== -1) Object.assign(mockDb.customers[idx], data);
    return delay({ ...mockDb.customers[idx] });
  },

  deactivate: (id: string): Promise<void> => {
    if (!USE_MOCK) return apiClient.delete(`/api/customers/${id}`).then((r) => r.data);
    const c = mockDb.customers.find((c) => c.id === id);
    if (c) c.is_active = false;
    return delay(undefined);
  },

  getPricing: (id: string): Promise<CustomerPricingItem[]> => {
    if (!USE_MOCK) return apiClient.get<CustomerPricingItem[]>(`/api/customers/${id}/pricing`).then((r) => r.data);
    const pricing = mockDb.customerPricing[id];
    if (pricing) return delay([...pricing]);
    // Return all active products with no custom price for customers without saved pricing
    const items: CustomerPricingItem[] = mockDb.products
      .filter((p) => p.is_active)
      .map((p) => ({ product_id: p.id, product_name: p.name, base_price: p.base_price, custom_price: undefined }));
    return delay(items);
  },

  updatePricing: (id: string, items: { product_id: string; custom_price?: number }[]): Promise<void> => {
    if (!USE_MOCK) return apiClient.put(`/api/customers/${id}/pricing`, { items }).then((r) => r.data);
    const existing = mockDb.customerPricing[id] ?? [];
    items.forEach(({ product_id, custom_price }) => {
      const row = existing.find((r) => r.product_id === product_id);
      if (row) row.custom_price = custom_price;
    });
    mockDb.customerPricing[id] = existing;
    return delay(undefined);
  },

  getDebt: (id: string): Promise<{ outstanding_debt: number }> => {
    if (!USE_MOCK) return apiClient.get<{ outstanding_debt: number }>(`/api/customers/${id}/debt`).then((r) => r.data);
    const c = mockDb.customers.find((c) => c.id === id);
    return delay({ outstanding_debt: c?.outstanding_debt ?? 0 });
  },

  getContainerLoans: (id: string) => {
    if (!USE_MOCK) return apiClient.get(`/api/customers/${id}/container-loans`).then((r) => r.data);
    return delay(mockDb.containerLoans.filter((l) => l.customer_id === id));
  },
};
