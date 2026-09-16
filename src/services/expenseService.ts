import { apiClient } from '../hooks/useApi';
import { ApiError } from '../utils/apiError';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import type { Expense, ExpensePayload } from '../types';

function getTodayWIB(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

/**
 * Operational expenses (FR-CSH-006) — owner only.
 * Expenses surface as cash_out/operational_expense entries on the Arus Kas page.
 */
export const expenseService = {
  list: (date?: string): Promise<Expense[]> => {
    if (!USE_MOCK) {
      return apiClient.get<Expense[]>(`/api/expenses${date ? `?date=${date}` : ''}`).then((r) => r.data);
    }
    const filter = date ?? getTodayWIB();
    return delay(mockDb.expenses.filter((e) => e.expenseDate === filter));
  },

  create: (data: ExpensePayload): Promise<Expense> => {
    if (!USE_MOCK) return apiClient.post<Expense>('/api/expenses', data).then((r) => r.data);
    const expense: Expense = {
      id: uid(),
      ...data,
      createdByName: 'Demo User',
      createdAt: new Date().toISOString(),
    };
    mockDb.expenses.push(expense);
    return delay({ ...expense });
  },

  update: (id: string, data: ExpensePayload): Promise<Expense> => {
    if (!USE_MOCK) return apiClient.put<Expense>(`/api/expenses/${id}`, data).then((r) => r.data);
    const existing = mockDb.expenses.find((e) => e.id === id);
    if (!existing) throw new ApiError('Pengeluaran tidak ditemukan.', 404);
    Object.assign(existing, data);
    return delay({ ...existing });
  },

  remove: (id: string): Promise<void> => {
    if (!USE_MOCK) return apiClient.delete(`/api/expenses/${id}`).then(() => undefined);
    const index = mockDb.expenses.findIndex((e) => e.id === id);
    if (index < 0) throw new ApiError('Pengeluaran tidak ditemukan.', 404);
    mockDb.expenses.splice(index, 1);
    return delay(undefined);
  },
};
