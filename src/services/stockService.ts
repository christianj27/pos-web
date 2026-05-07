// import { apiClient } from '../hooks/useApi'; // MOCK MODE
import { mockDb, uid, delay } from '../mocks/db';
import type { StockLevel, StockMovement } from '../types';

export const stockService = {
  getLevels: (locationId?: string): Promise<StockLevel[]> => {
    // const params = locationId ? { location_id: locationId } : undefined;
    // return apiClient.get<StockLevel[]>('/api/stock/levels', { params }).then((r) => r.data);
    const levels = locationId
      ? mockDb.stockLevels.filter((l) => l.location_id === locationId)
      : [...mockDb.stockLevels];
    return delay(levels);
  },

  getMovements: (): Promise<StockMovement[]> =>
    // apiClient.get<StockMovement[]>('/api/stock/movements').then((r) => r.data),
    delay([...mockDb.stockMovements].reverse()),

  receive: (data: { product_id: string; to_location_id: string; quantity: number; container_status?: string; purchase_cost?: number; notes?: string }): Promise<void> => {
    // return apiClient.post('/api/stock/movements', { ...data, movement_type: 'receive' }).then((r) => r.data);
    const prod = mockDb.products.find((p) => p.id === data.product_id);
    const loc = mockDb.locations.find((l) => l.id === data.to_location_id);
    const mov: StockMovement = {
      id: uid(), movement_type: 'receive',
      product_id: data.product_id, product_name: prod?.name ?? '',
      to_location_id: data.to_location_id, to_location_name: loc?.name,
      quantity: data.quantity, container_status: data.container_status as StockMovement['container_status'],
      purchase_cost: data.purchase_cost, notes: data.notes,
      created_by_name: 'Demo User', created_at: new Date().toISOString(),
    };
    mockDb.stockMovements.push(mov);
    // Update stock level
    const existing = mockDb.stockLevels.find(
      (s) => s.product_id === data.product_id && s.location_id === data.to_location_id && s.container_status === data.container_status
    );
    if (existing) { existing.quantity += data.quantity; }
    else {
      mockDb.stockLevels.push({
        product_id: data.product_id, product_name: prod?.name ?? '', product_unit: prod?.unit ?? '',
        location_id: data.to_location_id, location_name: loc?.name ?? '',
        quantity: data.quantity, container_status: data.container_status as StockLevel['container_status'],
      });
    }
    return delay(undefined);
  },

  defect: (data: { product_id: string; from_location_id: string; quantity: number; container_status?: string; notes?: string }): Promise<void> => {
    // return apiClient.post('/api/stock/movements', { ...data, movement_type: 'defect' }).then((r) => r.data);
    const prod = mockDb.products.find((p) => p.id === data.product_id);
    const loc = mockDb.locations.find((l) => l.id === data.from_location_id);
    mockDb.stockMovements.push({
      id: uid(), movement_type: 'defect',
      product_id: data.product_id, product_name: prod?.name ?? '',
      from_location_id: data.from_location_id, from_location_name: loc?.name,
      quantity: data.quantity, container_status: data.container_status as StockMovement['container_status'],
      notes: data.notes, created_by_name: 'Demo User', created_at: new Date().toISOString(),
    });
    const existing = mockDb.stockLevels.find(
      (s) => s.product_id === data.product_id && s.location_id === data.from_location_id && s.container_status === data.container_status
    );
    if (existing) existing.quantity = Math.max(0, existing.quantity - data.quantity);
    return delay(undefined);
  },

  transfer: (data: { product_id: string; from_location_id: string; to_location_id: string; quantity: number; container_status?: string; notes?: string }): Promise<void> => {
    // return apiClient.post('/api/stock/transfer', data).then((r) => r.data);
    const prod = mockDb.products.find((p) => p.id === data.product_id);
    const fromLoc = mockDb.locations.find((l) => l.id === data.from_location_id);
    const toLoc = mockDb.locations.find((l) => l.id === data.to_location_id);
    mockDb.stockMovements.push({
      id: uid(), movement_type: 'transfer',
      product_id: data.product_id, product_name: prod?.name ?? '',
      from_location_id: data.from_location_id, from_location_name: fromLoc?.name,
      to_location_id: data.to_location_id, to_location_name: toLoc?.name,
      quantity: data.quantity, container_status: data.container_status as StockMovement['container_status'],
      notes: data.notes, created_by_name: 'Demo User', created_at: new Date().toISOString(),
    });
    const fromLevel = mockDb.stockLevels.find(
      (s) => s.product_id === data.product_id && s.location_id === data.from_location_id && s.container_status === data.container_status
    );
    if (fromLevel) fromLevel.quantity = Math.max(0, fromLevel.quantity - data.quantity);
    const toLevel = mockDb.stockLevels.find(
      (s) => s.product_id === data.product_id && s.location_id === data.to_location_id && s.container_status === data.container_status
    );
    if (toLevel) { toLevel.quantity += data.quantity; }
    else {
      mockDb.stockLevels.push({
        product_id: data.product_id, product_name: prod?.name ?? '', product_unit: prod?.unit ?? '',
        location_id: data.to_location_id, location_name: toLoc?.name ?? '',
        quantity: data.quantity, container_status: data.container_status as StockLevel['container_status'],
      });
    }
    return delay(undefined);
  },

  vendorExchange: (data: { product_id: string; location_id: string; empty_quantity: number; filled_quantity: number; purchase_cost: number; notes?: string }): Promise<void> => {
    // return apiClient.post('/api/stock/vendor-exchange', data).then((r) => r.data);
    const prod = mockDb.products.find((p) => p.id === data.product_id);
    const loc = mockDb.locations.find((l) => l.id === data.location_id);
    // Remove empties, add filled
    const emptyLevel = mockDb.stockLevels.find(
      (s) => s.product_id === data.product_id && s.location_id === data.location_id && s.container_status === 'empty'
    );
    if (emptyLevel) emptyLevel.quantity = Math.max(0, emptyLevel.quantity - data.empty_quantity);
    const filledLevel = mockDb.stockLevels.find(
      (s) => s.product_id === data.product_id && s.location_id === data.location_id && s.container_status === 'filled'
    );
    if (filledLevel) { filledLevel.quantity += data.filled_quantity; }
    else {
      mockDb.stockLevels.push({
        product_id: data.product_id, product_name: prod?.name ?? '', product_unit: prod?.unit ?? '',
        location_id: data.location_id, location_name: loc?.name ?? '',
        quantity: data.filled_quantity, container_status: 'filled',
      });
    }
    mockDb.stockMovements.push({
      id: uid(), movement_type: 'receive',
      product_id: data.product_id, product_name: prod?.name ?? '',
      to_location_id: data.location_id, to_location_name: loc?.name,
      quantity: data.filled_quantity, container_status: 'filled',
      purchase_cost: data.purchase_cost, notes: data.notes ?? 'Tukar vendor',
      created_by_name: 'Demo User', created_at: new Date().toISOString(),
    });
    return delay(undefined);
  },
};
