import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { StockLevel, StockMovement } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findOrCreateLevel(productId: string, locationId: string): StockLevel {
  const prod = mockDb.products.find((p) => p.id === productId);
  const loc  = mockDb.locations.find((l) => l.id === locationId);
  let level  = mockDb.stockLevels.find(
    (s) => s.product_id === productId && s.location_id === locationId,
  );
  if (!level) {
    const isRefillable = prod?.category === 'refillable';
    level = {
      product_id: productId, product_name: prod?.name ?? '',
      product_unit: prod?.unit ?? '', product_category: prod?.category ?? 'simple',
      location_id: locationId, location_name: loc?.name ?? '',
      quantity_filled: isRefillable ? 0 : null,
      quantity_empty:  isRefillable ? 0 : null,
      quantity_total:  isRefillable ? null : 0,
    };
    mockDb.stockLevels.push(level);
  }
  return level;
}

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const stockService = {
  getLevels: (locationId?: string): Promise<StockLevel[]> => {
    if (!USE_MOCK) {
      const params = locationId ? { location_id: locationId } : undefined;
      return apiClient.get<StockLevel[]>('/api/stock/levels', { params }).then((r) => r.data);
    }
    const levels = locationId
      ? mockDb.stockLevels.filter((l) => l.location_id === locationId)
      : [...mockDb.stockLevels];
    return delay(levels);
  },

  getMovements: (date?: string): Promise<StockMovement[]> => {
    if (!USE_MOCK) return apiClient.get<StockMovement[]>(`/api/stock/movements${date ? `?date=${date}` : ''}`).then((r) => r.data);
    const all = [...mockDb.stockMovements].reverse();
    const filtered = date ? all.filter((m) => toWIBDate(m.created_at) === date) : all;
    return delay(filtered);
  },

  receive: (data: { product_id: string; to_location_id: string; quantity: number; container_status?: string; purchase_cost?: number; note?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/movements', { ...data, movement_type: 'receive' }).then((r) => r.data);
    const prod = mockDb.products.find((p) => p.id === data.product_id);
    const loc  = mockDb.locations.find((l) => l.id === data.to_location_id);
    mockDb.stockMovements.push({
      id: uid(), movement_type: 'receive',
      product_id: data.product_id, product_name: prod?.name ?? '',
      to_location_id: data.to_location_id, to_location_name: loc?.name,
      quantity: data.quantity, container_status: data.container_status as StockMovement['container_status'],
      purchase_cost: data.purchase_cost, note: data.note,
      created_by_name: 'Demo User', created_at: new Date().toISOString(),
    });
    const level = findOrCreateLevel(data.product_id, data.to_location_id);
    if (prod?.category === 'refillable') {
      if (data.container_status === 'filled') level.quantity_filled = (level.quantity_filled ?? 0) + data.quantity;
      else level.quantity_empty = (level.quantity_empty ?? 0) + data.quantity;
    } else {
      level.quantity_total = (level.quantity_total ?? 0) + data.quantity;
    }
    return delay(undefined);
  },

  defect: (data: { product_id: string; from_location_id: string; quantity: number; container_status?: string; note?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/movements', { ...data, movement_type: 'defect' }).then((r) => r.data);
    const prod = mockDb.products.find((p) => p.id === data.product_id);
    const loc  = mockDb.locations.find((l) => l.id === data.from_location_id);
    mockDb.stockMovements.push({
      id: uid(), movement_type: 'defect',
      product_id: data.product_id, product_name: prod?.name ?? '',
      from_location_id: data.from_location_id, from_location_name: loc?.name,
      quantity: data.quantity, container_status: data.container_status as StockMovement['container_status'],
      note: data.note, created_by_name: 'Demo User', created_at: new Date().toISOString(),
    });
    const level = findOrCreateLevel(data.product_id, data.from_location_id);
    if (prod?.category === 'refillable') {
      if (data.container_status === 'filled') level.quantity_filled = Math.max(0, (level.quantity_filled ?? 0) - data.quantity);
      else level.quantity_empty = Math.max(0, (level.quantity_empty ?? 0) - data.quantity);
    } else {
      level.quantity_total = Math.max(0, (level.quantity_total ?? 0) - data.quantity);
    }
    return delay(undefined);
  },

  transfer: (data: { product_id: string; from_location_id: string; to_location_id: string; quantity: number; container_status?: string; note?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/transfer', data).then((r) => r.data);
    const prod    = mockDb.products.find((p) => p.id === data.product_id);
    const fromLoc = mockDb.locations.find((l) => l.id === data.from_location_id);
    const toLoc   = mockDb.locations.find((l) => l.id === data.to_location_id);
    mockDb.stockMovements.push({
      id: uid(), movement_type: 'transfer',
      product_id: data.product_id, product_name: prod?.name ?? '',
      from_location_id: data.from_location_id, from_location_name: fromLoc?.name,
      to_location_id: data.to_location_id, to_location_name: toLoc?.name,
      quantity: data.quantity, container_status: data.container_status as StockMovement['container_status'],
      note: data.note, created_by_name: 'Demo User', created_at: new Date().toISOString(),
    });
    const fromLevel = findOrCreateLevel(data.product_id, data.from_location_id);
    const toLevel   = findOrCreateLevel(data.product_id, data.to_location_id);
    if (prod?.category === 'refillable') {
      if (data.container_status === 'filled') {
        fromLevel.quantity_filled = Math.max(0, (fromLevel.quantity_filled ?? 0) - data.quantity);
        toLevel.quantity_filled   = (toLevel.quantity_filled ?? 0) + data.quantity;
      } else {
        fromLevel.quantity_empty  = Math.max(0, (fromLevel.quantity_empty ?? 0) - data.quantity);
        toLevel.quantity_empty    = (toLevel.quantity_empty ?? 0) + data.quantity;
      }
    } else {
      fromLevel.quantity_total = Math.max(0, (fromLevel.quantity_total ?? 0) - data.quantity);
      toLevel.quantity_total   = (toLevel.quantity_total ?? 0) + data.quantity;
    }
    return delay(undefined);
  },

  vendorExchange: (data: { product_id: string; location_id: string; empty_quantity: number; filled_quantity: number; purchase_cost: number; note?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/vendor-exchange', data).then((r) => r.data);
    const prod  = mockDb.products.find((p) => p.id === data.product_id);
    const loc   = mockDb.locations.find((l) => l.id === data.location_id);
    const level = findOrCreateLevel(data.product_id, data.location_id);
    level.quantity_empty  = Math.max(0, (level.quantity_empty ?? 0) - data.empty_quantity);
    level.quantity_filled = (level.quantity_filled ?? 0) + data.filled_quantity;
    mockDb.stockMovements.push({
      id: uid(), movement_type: 'receive',
      product_id: data.product_id, product_name: prod?.name ?? '',
      to_location_id: data.location_id, to_location_name: loc?.name,
      quantity: data.filled_quantity, container_status: 'filled',
      purchase_cost: data.purchase_cost, note: data.note ?? 'Tukar vendor',
      created_by_name: 'Demo User', created_at: new Date().toISOString(),
    });
    return delay(undefined);
  },

  /** Atomically converts empty containers → filled for self_produced refillable products. */
  production: (data: { product_id: string; location_id: string; quantity: number; production_cost?: number; note?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/production', data).then((r) => r.data);
    const prod  = mockDb.products.find((p) => p.id === data.product_id);
    const loc   = mockDb.locations.find((l) => l.id === data.location_id);
    const level = findOrCreateLevel(data.product_id, data.location_id);
    level.quantity_empty  = Math.max(0, (level.quantity_empty ?? 0) - data.quantity);
    level.quantity_filled = (level.quantity_filled ?? 0) + data.quantity;
    const noteTxt = data.note
      ? `[Produksi] ${data.note}`
      : `[Produksi] Isi ${data.quantity} ${prod?.unit ?? ''} dari kontainer kosong`;
    mockDb.stockMovements.push({
      id: uid(), movement_type: 'production',
      product_id: data.product_id, product_name: prod?.name ?? '',
      from_location_id: data.location_id, from_location_name: loc?.name,
      to_location_id: data.location_id, to_location_name: loc?.name,
      quantity: data.quantity, container_status: 'filled',
      purchase_cost: data.production_cost, note: noteTxt,
      created_by_name: 'Demo User', created_at: new Date().toISOString(),
    });
    return delay(undefined);
  },

  /** Receive multiple products into the same destination in one operation.
   *  Real API: POST /api/stock/movements/bulk
   *  Mock: delegates to receive() for each item sequentially.
   */
  receiveBulk: (data: {
    to_location_id: string;
    note?: string;
    items: { product_id: string; quantity: number; container_status?: string; purchase_cost?: number }[];
  }): Promise<void> => {
    // return apiClient.post('/api/stock/movements/bulk', { movement_type: 'receive', to_location_id: data.to_location_id, note: data.note, items: data.items }).then((r) => r.data);
    return data.items.reduce(
      (p, item) => p.then(() => stockService.receive({ ...item, to_location_id: data.to_location_id, note: data.note })),
      Promise.resolve() as Promise<void>,
    );
  },

  /** Transfer multiple products between the same pair of locations in one operation.
   *  Real API: POST /api/stock/transfer/bulk
   *  Mock: delegates to transfer() for each item sequentially.
   */
  transferBulk: (data: {
    from_location_id: string;
    to_location_id: string;
    note?: string;
    items: { product_id: string; quantity: number; container_status?: string }[];
  }): Promise<void> => {
    // return apiClient.post('/api/stock/transfer/bulk', data).then((r) => r.data);
    return data.items.reduce(
      (p, item) => p.then(() => stockService.transfer({ ...item, from_location_id: data.from_location_id, to_location_id: data.to_location_id, note: data.note })),
      Promise.resolve() as Promise<void>,
    );
  },

  /** Exchange containers with vendor for multiple products in one operation.
   *  Real API: POST /api/stock/vendor-exchange/bulk
   *  Mock: delegates to vendorExchange() for each item sequentially.
   */
  vendorExchangeBulk: (data: {
    location_id: string;
    note?: string;
    items: { product_id: string; empty_quantity: number; filled_quantity: number; purchase_cost: number }[];
  }): Promise<void> => {
    // return apiClient.post('/api/stock/vendor-exchange/bulk', data).then((r) => r.data);
    return data.items.reduce(
      (p, item) => p.then(() => stockService.vendorExchange({ ...item, location_id: data.location_id, note: data.note })),
      Promise.resolve() as Promise<void>,
    );
  },
};

