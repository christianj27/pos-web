import type { ExpenseCategory } from '../types';

/**
 * Indonesian labels for operational expense categories.
 * Mirrors `ExpenseCategoryExtensions` on the backend (FR-CSH-006).
 */
export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  fuel: 'Bensin',
  dues: 'Iuran',
  electricity: 'Listrik',
  gallon_cap: 'Tutup Galon',
  cleaning: 'Kebersihan',
  salary: 'Gaji Karyawan',
  other: 'Lainnya',
};

export const EXPENSE_CATEGORY_OPTIONS = (
  Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]
).map((value) => ({ value, label: EXPENSE_CATEGORY_LABELS[value] }));

/** Resolves a category label, falling back to the raw value for unknown categories. */
export function expenseCategoryLabel(category: string): string {
  return EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category;
}
