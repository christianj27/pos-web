import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { StockLevel, StockMovement } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findOrCreateLevel(productId: string, locationId: string): StockLevel {
  const prod = mockDb.products.find((p) => p.id === productId);
  const loc  = mockDb.locations.find((l) => l.id === locationId);
  let level  = mockDb.stockLevels.find(
    (s) => s.productId === productId && s.locationId === locationId,
  );
  if (!level) {
    const isRefillable = prod?.category === 'refillable';
    level = {
      productId, productName: prod?.name ?? '',
      productUnit: prod?.unit ?? '', productCategory: prod?.category ?? 'simple',
      locationId, locationName: loc?.name ?? '',
      quantityFilled: isRefillable ? 0 : null,
      quantityEmpty:  isRefillable ? 0 : null,
      quantityTotal:  isRefillable ? null : 0,
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
      const params = locationId ? { locationId } : undefined;
      return apiClient.get<StockLevel[]>('/api/stock/levels', { params }).then((r) => r.data);
    }
    const levels = locationId
      ? mockDb.stockLevels.filter((l) => l.locationId === locationId)
      : [...mockDb.stockLevels];
    return delay(levels);
  },

  getMovements: (date?: string): Promise<StockMovement[]> => {
    if (!USE_MOCK) return apiClient.get<StockMovement[]>(`/api/stock/movements${date ? `?date=${date}` : ''}`).then((r) => r.data);
    const all = [...mockDb.stockMovements].reverse();
    const filtered = date ? all.filter((m) => toWIBDate(m.createdAt) === date) : all;
    return delay(filtered);
  },

  receive: (data: { productId: string; toLocationId: string; quantity: number; containerStatus?: string; purchaseCost?: number; note?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/movements', { ...data, movementType: 'receive' }).then((r) => r.data);
    const prod = mockDb.products.find((p) => p.id === data.productId);
    const loc  = mockDb.locations.find((l) => l.id === data.toLocationId);
    mockDb.stockMovements.push({
      id: uid(), movementType: 'receive',
      productId: data.productId, productName: prod?.name ?? '',
      toLocationId: data.toLocationId, toLocationName: loc?.name,
      quantity: data.quantity, containerStatus: data.containerStatus as StockMovement['containerStatus'],
      purchaseCost: data.purchaseCost, note: data.note,
      createdByName: 'Demo User', createdAt: new Date().toISOString(),
    });
    const level = findOrCreateLevel(data.productId, data.toLocationId);
    if (prod?.category === 'refillable') {
      if (data.containerStatus === 'filled') level.quantityFilled = (level.quantityFilled ?? 0) + data.quantity;
      else level.quantityEmpty = (level.quantityEmpty ?? 0) + data.quantity;
    } else {
      level.quantityTotal = (level.quantityTotal ?? 0) + data.quantity;
    }
    return delay(undefined);
  },

  defect: (data: { productId: string; fromLocationId: string; quantity: number; containerStatus?: string; note?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/movements', { ...data, movementType: 'defect' }).then((r) => r.data);
    const prod = mockDb.products.find((p) => p.id === data.productId);
    const loc  = mockDb.locations.find((l) => l.id === data.fromLocationId);
    mockDb.stockMovements.push({
      id: uid(), movementType: 'defect',
      productId: data.productId, productName: prod?.name ?? '',
      fromLocationId: data.fromLocationId, fromLocationName: loc?.name,
      quantity: data.quantity, containerStatus: data.containerStatus as StockMovement['containerStatus'],
      note: data.note, createdByName: 'Demo User', createdAt: new Date().toISOString(),
    });
    const level = findOrCreateLevel(data.productId, data.fromLocationId);
    if (prod?.category === 'refillable') {
      if (data.containerStatus === 'filled') level.quantityFilled = Math.max(0, (level.quantityFilled ?? 0) - data.quantity);
      else level.quantityEmpty = Math.max(0, (level.quantityEmpty ?? 0) - data.quantity);
    } else {
      level.quantityTotal = Math.max(0, (level.quantityTotal ?? 0) - data.quantity);
    }
    return delay(undefined);
  },

  transfer: (data: { productId: string; fromLocationId: string; toLocationId: string; quantity: number; containerStatus?: string; note?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/transfer', data).then((r) => r.data);
    const prod    = mockDb.products.find((p) => p.id === data.productId);
    const fromLoc = mockDb.locations.find((l) => l.id === data.fromLocationId);
    const toLoc   = mockDb.locations.find((l) => l.id === data.toLocationId);
    mockDb.stockMovements.push({
      id: uid(), movementType: 'transfer',
      productId: data.productId, productName: prod?.name ?? '',
      fromLocationId: data.fromLocationId, fromLocationName: fromLoc?.name,
      toLocationId: data.toLocationId, toLocationName: toLoc?.name,
      quantity: data.quantity, containerStatus: data.containerStatus as StockMovement['containerStatus'],
      note: data.note, createdByName: 'Demo User', createdAt: new Date().toISOString(),
    });
    const fromLevel = findOrCreateLevel(data.productId, data.fromLocationId);
    const toLevel   = findOrCreateLevel(data.productId, data.toLocationId);
    if (prod?.category === 'refillable') {
      if (data.containerStatus === 'filled') {
        fromLevel.quantityFilled = Math.max(0, (fromLevel.quantityFilled ?? 0) - data.quantity);
        toLevel.quantityFilled   = (toLevel.quantityFilled ?? 0) + data.quantity;
      } else {
        fromLevel.quantityEmpty  = Math.max(0, (fromLevel.quantityEmpty ?? 0) - data.quantity);
        toLevel.quantityEmpty    = (toLevel.quantityEmpty ?? 0) + data.quantity;
      }
    } else {
      fromLevel.quantityTotal = Math.max(0, (fromLevel.quantityTotal ?? 0) - data.quantity);
      toLevel.quantityTotal   = (toLevel.quantityTotal ?? 0) + data.quantity;
    }
    return delay(undefined);
  },

  vendorExchange: (data: { productId: string; locationId: string; emptyQuantity: number; filledQuantity: number; purchaseCost: number; note?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/vendor-exchange', data).then((r) => r.data);
    const prod  = mockDb.products.find((p) => p.id === data.productId);
    const loc   = mockDb.locations.find((l) => l.id === data.locationId);
    const level = findOrCreateLevel(data.productId, data.locationId);
    level.quantityEmpty  = Math.max(0, (level.quantityEmpty ?? 0) - data.emptyQuantity);
    level.quantityFilled = (level.quantityFilled ?? 0) + data.filledQuantity;
    mockDb.stockMovements.push({
      id: uid(), movementType: 'receive',
      productId: data.productId, productName: prod?.name ?? '',
      toLocationId: data.locationId, toLocationName: loc?.name,
      quantity: data.filledQuantity, containerStatus: 'filled',
      purchaseCost: data.purchaseCost, note: data.note ?? 'Tukar vendor',
      createdByName: 'Demo User', createdAt: new Date().toISOString(),
    });
    return delay(undefined);
  },

  /** Atomically converts empty containers → filled for selfproduced refillable products. */
  production: (data: { productId: string; locationId: string; quantity: number; productionCost?: number; note?: string }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/production', data).then((r) => r.data);
    const prod  = mockDb.products.find((p) => p.id === data.productId);
    const loc   = mockDb.locations.find((l) => l.id === data.locationId);
    const level = findOrCreateLevel(data.productId, data.locationId);
    level.quantityEmpty  = Math.max(0, (level.quantityEmpty ?? 0) - data.quantity);
    level.quantityFilled = (level.quantityFilled ?? 0) + data.quantity;
    const noteTxt = data.note
      ? `[Produksi] ${data.note}`
      : `[Produksi] Isi ${data.quantity} ${prod?.unit ?? ''} dari kontainer kosong`;
    mockDb.stockMovements.push({
      id: uid(), movementType: 'production',
      productId: data.productId, productName: prod?.name ?? '',
      fromLocationId: data.locationId, fromLocationName: loc?.name,
      toLocationId: data.locationId, toLocationName: loc?.name,
      quantity: data.quantity, containerStatus: 'filled',
      purchaseCost: data.productionCost, note: noteTxt,
      createdByName: 'Demo User', createdAt: new Date().toISOString(),
    });
    return delay(undefined);
  },

  /** Receive multiple products into the same destination in one operation.
   *  Real API: POST /api/stock/movements/bulk
   *  Mock: delegates to receive() for each item sequentially.
   */
  receiveBulk: (data: {
    toLocationId: string;
    note?: string;
    items: { productId: string; quantity: number; containerStatus?: string; purchaseCost?: number }[];
  }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/movements/bulk', { movementType: 'receive', toLocationId: data.toLocationId, note: data.note, items: data.items }).then(() => undefined);
    return data.items.reduce(
      (p, item) => p.then(() => stockService.receive({ ...item, toLocationId: data.toLocationId, note: data.note })),
      Promise.resolve() as Promise<void>,
    );
  },

  /** Transfer multiple products between the same pair of locations in one operation.
   *  Real API: POST /api/stock/transfer/bulk
   *  Mock: delegates to transfer() for each item sequentially.
   */
  transferBulk: (data: {
    fromLocationId: string;
    toLocationId: string;
    note?: string;
    items: { productId: string; quantity: number; containerStatus?: string }[];
  }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/transfer/bulk', data).then(() => undefined);
    return data.items.reduce(
      (p, item) => p.then(() => stockService.transfer({ ...item, fromLocationId: data.fromLocationId, toLocationId: data.toLocationId, note: data.note })),
      Promise.resolve() as Promise<void>,
    );
  },

  /** Exchange containers with vendor for multiple products in one operation.
   *  Real API: POST /api/stock/vendor-exchange/bulk
   *  Mock: delegates to vendorExchange() for each item sequentially.
   */
  vendorExchangeBulk: (data: {
    locationId: string;
    note?: string;
    items: { productId: string; emptyQuantity: number; filledQuantity: number; purchaseCost: number }[];
  }): Promise<void> => {
    if (!USE_MOCK) return apiClient.post('/api/stock/vendor-exchange/bulk', data).then(() => undefined);
    return data.items.reduce(
      (p, item) => p.then(() => stockService.vendorExchange({ ...item, locationId: data.locationId, note: data.note })),
      Promise.resolve() as Promise<void>,
    );
  },

  /** Cancel/reverse a stock movement batch. Owner only. */
  reverseMovement: (id: string): Promise<StockMovement[]> => {
    return apiClient.post<StockMovement[]>(`/api/stock/movements/${id}/reverse`).then((r) => r.data);
  },

  /** Create a stock adjustment to reconcile physical vs system stock. Owner only. */
  adjust: (data: { locationId: string; productId: string; adjustmentQuantity: number; containerStatus?: string; note: string }): Promise<void> => {
    return apiClient.post('/api/stock/adjustment', data).then(() => undefined);
  },
};

