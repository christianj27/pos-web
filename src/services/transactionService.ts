import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { Transaction } from '../types';

export interface CreateTransactionPayload {
  type: string;
  customerId?: string;
  locationId?: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
  paidAmount: number;
  paymentMethod?: 'cash' | 'transfer' | 'qris';
  notes?: string;
  containerReturns?: { productId: string; quantity: number }[];
  debtPaymentAmount?: number;
}

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

export const transactionService = {
  list: (date?: string): Promise<Transaction[]> => {
    if (!USE_MOCK) return apiClient.get<Transaction[]>(`/api/transactions${date ? `?date=${date}` : ''}`).then((r) => r.data);
    const all = [...mockDb.transactions].reverse();
    const filtered = date ? all.filter((tx) => toWIBDate(tx.createdAt) === date) : all;
    return delay(filtered);
  },

  get: (id: string): Promise<Transaction> => {
    if (!USE_MOCK) return apiClient.get<Transaction>(`/api/transactions/${id}`).then((r) => r.data);
    const tx = mockDb.transactions.find((t) => t.id === id)!;
    return delay({ ...tx });
  },

  create: (data: CreateTransactionPayload): Promise<Transaction> => {
    if (!USE_MOCK) return apiClient.post<Transaction>('/api/transactions', data).then((r) => r.data);
    const customer = data.customerId ? mockDb.customers.find((c) => c.id === data.customerId) : undefined;
    const location = data.locationId ? mockDb.locations.find((l) => l.id === data.locationId) : undefined;
    const items = data.items.map((i) => {
      const prod = mockDb.products.find((p) => p.id === i.productId);
      return { productId: i.productId, productName: prod?.name ?? '', quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.quantity * i.unitPrice };
    });
    const totalAmount = items.reduce((s, i) => s + i.subtotal, 0);
    const tx: Transaction = {
      id: uid(), transactionType: data.type as Transaction['transactionType'],
      customerId: customer?.id, customerName: customer?.name,
      staffId: 'mock-user-id', staffName: 'Demo User',
      locationId: location?.id, locationName: location?.name,
      items, totalAmount, paidAmount: data.paidAmount,
      paymentMethod: data.paymentMethod ?? 'cash',
      notes: data.notes,
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
    mockDb.transactions.push(tx);
    // Update customer debt if underpaid
    const debt = totalAmount - data.paidAmount;
    if (customer && debt > 0) {
      customer.outstandingDebt = (customer.outstandingDebt ?? 0) + debt;
    }
    // Record ContainerLoans for refillable items (positive = lent) + dispatch StockMovements
    if (customer) {
      data.items.forEach((item) => {
        const prod = mockDb.products.find((p) => p.id === item.productId);
        if (prod?.category === 'refillable') {
          mockDb.containerLoans.push({
            id: uid(), customerId: customer.id, customerName: customer.name ?? '',
            productId: item.productId, productName: prod.name,
            quantity: item.quantity, transactionId: tx.id,
            createdByName: 'Demo User', createdAt: new Date().toISOString(),
          });
          // Dispatch movement: filled stock leaving the source location
          mockDb.stockMovements.push({
            id: uid(),
            movementType: 'dispatch',
            productId: item.productId, productName: prod.name,
            fromLocationId: tx.locationId ?? '',
            fromLocationName: tx.locationName ?? '',
            quantity: item.quantity,
            containerStatus: 'filled',
            note: `Penjualan ${tx.id} — ${customer.name}`,
            createdByName: 'Demo User', createdAt: new Date().toISOString(),
          });
        }
      });
      // Record container returns (negative ContainerLoans) + receive StockMovements
      if (data.containerReturns) {
        data.containerReturns.forEach((ret) => {
          if (ret.quantity > 0) {
            const retProd = mockDb.products.find((p) => p.id === ret.productId);
            mockDb.containerLoans.push({
              id: uid(), customerId: customer.id, customerName: customer.name ?? '',
              productId: ret.productId, productName: retProd?.name ?? '',
              quantity: -ret.quantity, transactionId: tx.id,
              createdByName: 'Demo User', createdAt: new Date().toISOString(),
            });
            // Receive movement: empty containers arriving at source location
            mockDb.stockMovements.push({
              id: uid(),
              movementType: 'receive',
              productId: ret.productId, productName: retProd?.name ?? '',
              toLocationId: tx.locationId ?? '',
              toLocationName: tx.locationName ?? '',
              quantity: ret.quantity,
              containerStatus: 'empty',
              note: `Kontainer kosong diterima dari ${customer.name} (${tx.id})`,
              createdByName: 'Demo User', createdAt: new Date().toISOString(),
            });
          }
        });
      }
    }
    // Record old debt payment if provided
    if (customer && data.debtPaymentAmount && data.debtPaymentAmount > 0) {
      mockDb.debtPayments.push({
        id: uid(), customerId: customer.id, customerName: customer.name ?? '',
        amount: data.debtPaymentAmount, method: 'cash', transactionId: tx.id,
        createdByName: 'Demo User', createdAt: new Date().toISOString(),
      });
      customer.outstandingDebt = Math.max(0, (customer.outstandingDebt ?? 0) - data.debtPaymentAmount);
    }
    return delay({ ...tx });
  },

  updateStatus: (id: string, status: string): Promise<void> => {
    if (!USE_MOCK) return apiClient.put(`/api/transactions/${id}/status`, { status }).then((r) => r.data);
    const tx = mockDb.transactions.find((t) => t.id === id);
    if (tx && status === 'cancelled') {
      tx.status = 'cancelled';
      // Auto-reverse stock: add compensating StockMovements (receive back to source)
      tx.items.forEach((item) => {
        mockDb.stockMovements.push({
          id: uid(),
          productId: item.productId,
          productName: item.productName,
          toLocationId: tx.locationId ?? '',
          toLocationName: tx.locationName ?? '',
          movementType: 'receive',
          quantity: item.quantity,
          note: `Pembatalan transaksi #${tx.id}`,
          createdByName: 'System',
          createdAt: new Date().toISOString(),
        });
      });
      // Reverse ContainerLoans created for this transaction
      const loansForTx = mockDb.containerLoans.filter((l) => l.transactionId === id);
      loansForTx.forEach((loan) => {
        mockDb.containerLoans.push({
          id: uid(),
          customerId: loan.customerId,
          customerName: loan.customerName,
          productId: loan.productId,
          productName: loan.productName,
          quantity: -loan.quantity,
          transactionId: tx.id,
          notes: `Pembatalan transaksi #${tx.id}`,
          createdByName: 'System',
          createdAt: new Date().toISOString(),
        });
      });
      // Restore customer debt if paidAmount < totalAmount
      const debt = tx.totalAmount - tx.paidAmount;
      if (tx.customerId && debt > 0) {
        const c = mockDb.customers.find((c) => c.id === tx.customerId);
        if (c) c.outstandingDebt = Math.max(0, (c.outstandingDebt ?? 0) - debt);
      }
    }
    return delay(undefined);
  },

  addPayment: (id: string, amount: number): Promise<void> => {
    if (!USE_MOCK) return apiClient.post(`/api/transactions/${id}/payments`, { amount }).then((r) => r.data);
    const tx = mockDb.transactions.find((t) => t.id === id);
    if (tx) {
      tx.paidAmount = Math.min(tx.totalAmount, tx.paidAmount + amount);
      if (tx.paidAmount >= tx.totalAmount) tx.status = 'completed';
      // Reduce customer debt
      if (tx.customerId) {
        const c = mockDb.customers.find((c) => c.id === tx.customerId);
        if (c) c.outstandingDebt = Math.max(0, (c.outstandingDebt ?? 0) - amount);
      }
    }
    return delay(undefined);
  },
};
