// import { apiClient } from '../hooks/useApi'; // MOCK MODE
import { mockDb, uid, delay } from '../mocks/db';
import { transactionService } from './transactionService';
import type { DeliveryAssignment, DeliveryAssignmentItem } from '../types';

export interface CreateAssignmentPayload {
  kurir_id: string;
  customer_id: string;
  items: { product_id: string; quantity: number; unit_price: number }[];
  notes?: string;
}

export interface FulfillAssignmentPayload {
  items: { product_id: string; quantity: number; unit_price: number }[];
  paid_amount: number;
  payment_method?: 'cash' | 'transfer' | 'qris';
  notes?: string;
  container_returns?: { product_id: string; quantity: number }[];
  debt_payment_amount?: number;
}

export const assignmentService = {
  list: (role: string, userId?: string): Promise<DeliveryAssignment[]> => {
    const all = [...mockDb.assignments].reverse();
    if (role === 'kurir') {
      return delay(all.filter((a) => a.kurir_id === userId));
    }
    return delay(all);
  },

  create: (payload: CreateAssignmentPayload): Promise<DeliveryAssignment> => {
    const kurir = mockDb.users.find((u) => u.id === payload.kurir_id);
    const customer = mockDb.customers.find((c) => c.id === payload.customer_id);

    if (!kurir) throw new Error('Kurir tidak ditemukan.');
    if (!customer) throw new Error('Pelanggan tidak ditemukan.');

    const items: DeliveryAssignmentItem[] = payload.items.map((i) => {
      const prod = mockDb.products.find((p) => p.id === i.product_id);
      return {
        product_id: i.product_id,
        product_name: prod?.name ?? '',
        quantity: i.quantity,
        unit_price: i.unit_price,
      };
    });

    const assignment: DeliveryAssignment = {
      id: uid(),
      kurir_id: kurir.id,
      kurir_name: kurir.name,
      customer_id: customer.id,
      customer_name: customer.name,
      items,
      notes: payload.notes,
      status: 'pending',
      created_by_name: 'Demo User',
      created_at: new Date().toISOString(),
    };

    mockDb.assignments.push(assignment);
    return delay({ ...assignment });
  },

  fulfill: async (id: string, payload: FulfillAssignmentPayload): Promise<void> => {
    const assignment = mockDb.assignments.find((a) => a.id === id);
    if (!assignment) throw new Error('Penugasan tidak ditemukan.');

    const truck = mockDb.locations.find(
      (l) => l.type === 'vehicle' && l.assigned_to === assignment.kurir_id && l.is_active,
    );
    if (!truck) throw new Error('Kurir ini belum memiliki kendaraan aktif.');

    const tx = await transactionService.create({
      type: 'delivery',
      customer_id: assignment.customer_id,
      location_id: truck.id,
      items: payload.items,
      paid_amount: payload.paid_amount,
      payment_method: payload.payment_method,
      notes: payload.notes,
      container_returns: payload.container_returns,
      debt_payment_amount: payload.debt_payment_amount,
    });

    assignment.status = 'fulfilled';
    assignment.transaction_id = tx.id;
  },

  cancel: (id: string): Promise<void> => {
    const assignment = mockDb.assignments.find((a) => a.id === id);
    if (!assignment) throw new Error('Penugasan tidak ditemukan.');
    assignment.status = 'cancelled';
    return delay(undefined);
  },
};
