import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import { resolveStockPeriodRange, todayWIB } from '../utils/stockPeriod';
import type {
  Customer,
  CustomerPricingItem,
  CustomerStockProductItem,
  CustomerStockStaffItem,
  CustomerStockSummaryResponse,
  StockPeriod,
} from '../types';

export interface CustomerStockSummaryQuery {
  period: StockPeriod;
  /** Anchor date for day/week/month/year (YYYY-MM-DD); ignored for a custom range. */
  date?: string;
  /** Required when `period === 'custom'` (YYYY-MM-DD). */
  startDate?: string;
  endDate?: string;
}

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

/**
 * Mock equivalent of `GET /api/customers/{id}/stock-summary` (FR-CST-011): only movements linked to
 * the customer's own transactions count, using the same Terjual / Dikembalikan rules as the API.
 * (The API resolves ownership through the movement's transaction; mock movements carry `customerId`.)
 */
function computeCustomerStockSummary(
  customerId: string,
  startDate: string,
  endDate: string,
): CustomerStockProductItem[] {
  const filtered = mockDb.stockMovements.filter((m) => {
    if (m.customerId !== customerId) return false;
    if (m.isReversed || m.isReversal) return false;
    const day = toWIBDate(m.createdAt);
    return day >= startDate && day <= endDate;
  });

  const byProduct = new Map<string, typeof filtered>();
  for (const m of filtered) {
    if (!byProduct.has(m.productId)) byProduct.set(m.productId, []);
    byProduct.get(m.productId)!.push(m);
  }

  const result: CustomerStockProductItem[] = [];
  for (const movements of byProduct.values()) {
    const first = movements[0];
    const product = mockDb.products.find((p) => p.id === first.productId);
    const isRefillable = product?.category === 'refillable';

    // Terjual: refillable = filled dispatch qty only; simple = every dispatch qty.
    const soldOf = (list: typeof filtered) =>
      isRefillable
        ? list.filter((m) => m.movementType === 'dispatch' && m.containerStatus === 'filled')
              .reduce((sum, m) => sum + m.quantity, 0)
        : list.filter((m) => m.movementType === 'dispatch')
              .reduce((sum, m) => sum + m.quantity, 0);

    // Dikembalikan: a customer only ever hands back empty containers.
    const returnedOf = (list: typeof filtered) =>
      list.filter((m) => m.movementType === 'receive' && m.containerStatus === 'empty')
          .reduce((sum, m) => sum + m.quantity, 0);

    const totalSold = soldOf(movements);
    const totalReturned = returnedOf(movements);
    if (totalSold === 0 && totalReturned === 0) continue;

    const staff: CustomerStockStaffItem[] = [];
    for (const name of Array.from(new Set(movements.map((m) => m.createdByName)))) {
      const own = movements.filter((m) => m.createdByName === name);
      const sold = soldOf(own);
      const returned = returnedOf(own);
      if (sold === 0 && returned === 0) continue;
      staff.push({
        staffId: mockDb.users.find((u) => u.name === name)?.id ?? name,
        staffName: name,
        sold,
        returned,
      });
    }
    staff.sort((a, b) => b.sold - a.sold || a.staffName.localeCompare(b.staffName));

    result.push({
      productId: first.productId,
      productName: first.productName,
      productUnit: product?.unit ?? '',
      productCategory: product?.category ?? 'simple',
      totalSold,
      totalReturned,
      staff,
    });
  }

  result.sort((a, b) => a.productName.localeCompare(b.productName));
  return result;
}

export const customerService = {
  /** Active customers only (FR-CST-010); the API excludes soft-deleted customers by default. */
  list: (role?: string): Promise<Customer[]> =>
    USE_MOCK
      ? delay(mockDb.customers.filter((c) => c.isActive && (role === 'owner' || !c.isConfidential)))
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

  /**
   * Soft delete (FR-CST-004): the record is retained so transaction history, debt history and
   * container loans stay intact, but it disappears from the list and every customer picker.
   */
  remove: (id: string): Promise<void> => {
    if (!USE_MOCK) return apiClient.delete(`/api/customers/${id}`).then((r) => r.data);
    const c = mockDb.customers.find((c) => c.id === id);
    if (c) c.isActive = false;
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

  /**
   * FR-CST-011 — per-customer "Pergerakan Stok" summary for a resolved period, mirroring
   * `GET /api/customers/{id}/stock-summary`. Available to all roles.
   */
  getStockSummary: (id: string, query: CustomerStockSummaryQuery): Promise<CustomerStockSummaryResponse> => {
    if (!USE_MOCK) {
      const params = new URLSearchParams({ period: query.period });
      if (query.period === 'custom') {
        params.set('start_date', query.startDate ?? '');
        params.set('end_date', query.endDate ?? '');
      } else {
        params.set('date', query.date ?? todayWIB());
      }
      return apiClient
        .get<CustomerStockSummaryResponse>(`/api/customers/${id}/stock-summary?${params.toString()}`)
        .then((r) => r.data);
    }

    const range = resolveStockPeriodRange(query.period, query.date ?? todayWIB(), query.startDate, query.endDate);
    return delay({
      customerId: id,
      customerName: mockDb.customers.find((c) => c.id === id)?.name ?? '',
      period: range.period,
      startDate: range.startDate,
      endDate: range.endDate,
      items: computeCustomerStockSummary(id, range.startDate, range.endDate),
    });
  },
};
