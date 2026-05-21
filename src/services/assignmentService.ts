import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import { transactionService } from './transactionService';
import type { DeliveryAssignment, DeliveryAssignmentItem } from '../types';

export interface CreateAssignmentPayload {
  kurirId: string;
  customerId: string;
  locationId: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
  notes?: string;
}

export interface FulfillAssignmentPayload {
  items: { productId: string; quantity: number; unitPrice: number }[];
  paidAmount: number;
  paymentMethod?: 'cash' | 'transfer' | 'qris';
  notes?: string;
  containerReturns?: { productId: string; quantity: number }[];
  debtPaymentAmount?: number;
}

export const assignmentService = {
  list: (role: string, userId?: string, date?: string): Promise<DeliveryAssignment[]> => {
    if (!USE_MOCK) {
      const params = date ? `?date=${date}` : '';
      return apiClient.get<DeliveryAssignment[]>(`/api/assignments${params}`).then((r) => r.data);
    }
    const toWIBDate = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(iso));
    let all = [...mockDb.assignments].reverse();
    if (date) all = all.filter((a) => toWIBDate(a.createdAt) === date);
    if (role === 'kurir') return delay(all.filter((a) => a.kurirId === userId));
    return delay(all);
  },

  create: (payload: CreateAssignmentPayload): Promise<DeliveryAssignment> => {
    if (!USE_MOCK) return apiClient.post<DeliveryAssignment>('/api/assignments', payload).then((r) => r.data);
    const kurir = mockDb.users.find((u) => u.id === payload.kurirId);
    const customer = mockDb.customers.find((c) => c.id === payload.customerId);
    const location = mockDb.locations.find((l) => l.id === payload.locationId);

    if (!kurir) throw new Error('Kurir tidak ditemukan.');
    if (!customer) throw new Error('Pelanggan tidak ditemukan.');
    if (!location) throw new Error('Lokasi tidak ditemukan.');

    const items: DeliveryAssignmentItem[] = payload.items.map((i) => {
      const prod = mockDb.products.find((p) => p.id === i.productId);
      return {
        productId: i.productId,
        productName: prod?.name ?? '',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      };
    });

    const assignment: DeliveryAssignment = {
      id: uid(),
      kurirId: kurir.id,
      kurirName: kurir.name,
      customerId: customer.id,
      customerName: customer.name,
      locationId: location.id,
      locationName: location.name,
      items,
      notes: payload.notes,
      status: 'pending',
      createdByName: 'Demo User',
      createdAt: new Date().toISOString(),
    };

    mockDb.assignments.push(assignment);
    return delay({ ...assignment });
  },

  fulfill: async (id: string, payload: FulfillAssignmentPayload): Promise<void> => {
    if (!USE_MOCK) { await apiClient.post(`/api/assignments/${id}/fulfill`, payload); return; }
    const assignment = mockDb.assignments.find((a) => a.id === id);
    if (!assignment) throw new Error('Penugasan tidak ditemukan.');

    // Use location stored on the assignment; fall back to kurir's vehicle for old records
    let locationId = assignment.locationId;
    if (!locationId) {
      const truck = mockDb.locations.find(
        (l) => l.type === 'vehicle' && l.assignedTo === assignment.kurirId && l.isActive,
      );
      if (!truck) throw new Error('Kurir ini belum memiliki kendaraan aktif.');
      locationId = truck.id;
    }

    const tx = await transactionService.create({
      transactionType: 'delivery',
      customerId: assignment.customerId,
      locationId,
      items: payload.items,
      paidAmount: payload.paidAmount,
      paymentMethod: payload.paymentMethod,
      notes: payload.notes,
      containerReturns: payload.containerReturns,
      debtPaymentAmount: payload.debtPaymentAmount,
    });

    assignment.status = 'fulfilled';
    assignment.transactionId = tx.id;
  },

  cancel: (id: string): Promise<void> => {
    if (!USE_MOCK) return apiClient.put(`/api/assignments/${id}/cancel`).then((r) => r.data);
    const assignment = mockDb.assignments.find((a) => a.id === id);
    if (!assignment) throw new Error('Penugasan tidak ditemukan.');
    assignment.status = 'cancelled';
    return delay(undefined);
  },
};
