import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { Product } from '../types';

export const productService = {
  list: (): Promise<Product[]> =>
    USE_MOCK ? delay([...mockDb.products]) : apiClient.get<Product[]>('/api/products').then((r) => r.data),

  create: (data: {
    name: string; category: string; productionType?: string;
    type: string; unit: string; basePrice: number;
  }): Promise<Product> => {
    if (!USE_MOCK) return apiClient.post<Product>('/api/products', data).then((r) => r.data);
    const prod: Product = {
      id: uid(), name: data.name, category: data.category as Product['category'],
      productionType: data.productionType as Product['productionType'],
      type: data.type as Product['type'], unit: data.unit,
      basePrice: data.basePrice, isActive: true, createdAt: new Date().toISOString(),
    };
    mockDb.products.push(prod);
    return delay({ ...prod });
  },

  update: (id: string, data: Partial<{ name: string; category: string; productionType: string; type: string; unit: string; basePrice: number; isActive: boolean }>): Promise<Product> => {
    if (!USE_MOCK) return apiClient.put<Product>(`/api/products/${id}`, data).then((r) => r.data);
    const idx = mockDb.products.findIndex((p) => p.id === id);
    if (idx !== -1) Object.assign(mockDb.products[idx], data);
    return delay({ ...mockDb.products[idx] });
  },

  toggleActive: (id: string): Promise<void> => {
    if (!USE_MOCK) return apiClient.patch(`/api/products/${id}`).then((r) => r.data);
    const p = mockDb.products.find((p) => p.id === id);
    if (p) p.isActive = !p.isActive;
    return delay(undefined);
  },
  
};
