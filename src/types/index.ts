// ─── User ─────────────────────────────────────────────────────────────────────
export type UserRole = 'owner' | 'kurir' | 'kasir';

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  role: UserRole;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

// ─── Location ─────────────────────────────────────────────────────────────────
export type LocationType = 'warehouse' | 'vehicle';

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  assignedTo?: string;
  assignedToName?: string;
  isActive: boolean;
  createdAt: string;
}

// ─── Product ──────────────────────────────────────────────────────────────────
export type ProductCategory = 'simple' | 'refillable';
export type ProductionType = 'purchased' | 'selfproduced';
export type ProductType = 'air' | 'gas';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  productionType?: ProductionType;
  type: ProductType;
  unit: string;
  basePrice: number;
  isActive: boolean;
  createdAt: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  isConfidential?: boolean;
  outstandingDebt?: number;
  initialDebt?: number;
  createdAt: string;
}

export interface CustomerPricingItem {
  productId: string;
  productName: string;
  basePrice: number;
  customPrice?: number;
}

// ─── Stock ────────────────────────────────────────────────────────────────────
export type ContainerStatus = 'filled' | 'empty';
export type MovementType = 'receive' | 'transfer' | 'dispatch' | 'defect' | 'production' | 'vendor_exchange' | 'adjustment';

export interface StockLevel {
  productId: string;
  productName: string;
  productUnit: string;
  productCategory: ProductCategory;
  locationId: string;
  locationName: string;
  /** null for simple products */
  quantityFilled: number | null;
  /** null for simple products */
  quantityEmpty: number | null;
  /** null for refillable products */
  quantityTotal: number | null;
}

export interface StockMovement {
  id: string;
  movementType: MovementType;
  productId: string;
  productName: string;
  fromLocationId?: string;
  fromLocationName?: string;
  toLocationId?: string;
  toLocationName?: string;
  quantity: number;
  containerStatus?: ContainerStatus;
  purchaseCost?: number;
  note?: string;
  createdByName: string;
  createdAt: string;
  customerName?: string;
  batchId?: string | null;
  isReversed?: boolean;
  isReversal?: boolean;
  containerLoanId?: string | null;
}

export interface BulkContainerLoanItem {
  productId: string;
  quantity: number;
  containerStatus: string;
  note?: string;
}

export interface CreateBulkContainerLoanRequest {
  customerId: string;
  locationId: string;
  items: BulkContainerLoanItem[];
  note?: string;
}

// ─── Transaction ──────────────────────────────────────────────────────────────
export type TransactionType = 'delivery' | 'counter';
export type TransactionStatus = 'completed' | 'cancelled';

export interface TransactionItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Transaction {
  id: string;
  transactionType: TransactionType;
  customerId?: string;
  customerName?: string;
  staffId: string;
  staffName: string;
  locationId?: string;
  locationName?: string;
  items: TransactionItem[];
  totalAmount: number;
  paidAmount: number;
  paymentMethod?: 'cash' | 'transfer' | 'qris';
  notes?: string;
  status: TransactionStatus;
  createdAt: string;
  completedAt?: string;
}

// ─── Delivery Assignment ─────────────────────────────────────────────────────
export type DeliveryAssignmentStatus = 'pending' | 'fulfilled' | 'cancelled';

export interface DeliveryAssignmentItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface DeliveryAssignment {
  id: string;
  kurirId: string;
  kurirName: string;
  customerId: string;
  customerName: string;
  locationId?: string;
  locationName?: string;
  items: DeliveryAssignmentItem[];
  notes?: string;
  status: DeliveryAssignmentStatus;
  createdByName: string;
  createdAt: string;
  transactionId?: string;
}

// ─── Debt Payment ─────────────────────────────────────────────────────────────
export interface DebtPayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  method: 'cash' | 'transfer' | 'qris';
  referenceNo?: string;
  transactionId?: string;
  note?: string;
  createdByName: string;
  createdAt: string;
}

// ─── Container Loan ───────────────────────────────────────────────────────────
export interface ContainerLoan {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  quantity: number;
  transactionId?: string;
  notes?: string;
  createdByName: string;
  createdAt: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface WeeklyChartEntry {
  date: string; // YYYY-MM-DD
  revenue: number;
  transactionCount: number;
  purchaseCost: number;
}

export interface RecentTransaction {
  id: string;
  createdAt: string;
  customerName?: string;
  createdByName: string;
  type: TransactionType;
  totalAmount: number;
  paidAmount: number;
  status: TransactionStatus;
  paymentMethod?: string;
}

export interface CustomerDebtSummary {
  customerId: string;
  customerName: string;
  outstandingDebt: number;
}

/** Net container balance per customer + product (FR-DSH-014). Positive = customer holds our containers. */
export interface ContainerLoanSummaryItem {
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  productUnit: string;
  netQuantity: number;
}

export interface StaffRevenueSummary {
  staffId: string;
  staffName: string;
  revenue: number;
  transactionCount: number;
}

export interface DailyStockProductSummary {
  productId: string;
  productName: string;
  productUnit: string;
  productCategory: ProductCategory;
  totalReceived: number;
  totalSold: number;
}

export interface PaymentMethodStaffItem {
  staffId: string;
  staffName: string;
  amount: number;
  count: number;
}

export interface PaymentMethodBreakdownItem {
  method: string; // 'cash' | 'transfer' | 'qris'
  label: string; // 'Tunai' | 'Transfer' | 'QRIS'
  amount: number;
  count: number;
  /** Per-staff breakdown of this payment method — owner only; always empty for kasir/kurir (FR-DSH-015) */
  staff?: PaymentMethodStaffItem[];
}

export interface DashboardStats {
  todayRevenue: number;
  todayTransactions: number;
  todayPurchaseCost: number;
  todayDebtCollected: number;
  lowStockCount: number;
  totalOutstandingDebt: number;
  previousDayRevenue: number;
  weeklyChart: WeeklyChartEntry[];
  recentTransactions: RecentTransaction[];
  warehouseStock: StockLevel[];
  customerDebts: CustomerDebtSummary[];
  containerLoans: ContainerLoanSummaryItem[];
  staffRevenue: StaffRevenueSummary[];
  dailyStockSummary: DailyStockProductSummary[];
  paymentMethodBreakdown?: PaymentMethodBreakdownItem[];
}

// ─── Debt History ─────────────────────────────────────────────────────────────
/** A transaction that created or partially created debt for a customer */
export interface DebtTransaction {
  id: string;
  createdAt: string;
  type: TransactionType;
  totalAmount: number;
  paidAmount: number;
  debtAmount: number;
  createdByName: string;
}

export interface CustomerDebtHistory {
  customerId: string;
  customerName: string;
  initialDebt: number;
  outstandingDebt: number;
  debtTransactions: DebtTransaction[];
  payments: DebtPayment[];
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────
export type CashFlowType = 'cash_in' | 'cash_out' | 'new_debt';
export type CashFlowCategory =
  | 'sale_payment'
  | 'debt_payment'
  | 'stock_purchase'
  | 'debt_created'
  | 'operational_expense';

export interface CashFlowEntry {
  index: string; // unique index for frontend rendering`
  id: string;
  flowType: CashFlowType;
  category: CashFlowCategory;
  amount: number;
  description: string;
  referenceId?: string;
  createdByName: string;
  createdAt: string;
}

export interface CashFlowSummary {
  totalCashIn: number;
  totalCashOut: number;
  netCash: number;
  totalNewDebt: number;
  entries: CashFlowEntry[];
}

// ─── Operational Expenses (FR-CSH-006) ────────────────────────────────────────
export type ExpenseCategory =
  | 'fuel'
  | 'dues'
  | 'electricity'
  | 'gallon_cap'
  | 'cleaning'
  | 'salary'
  | 'other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  /** Business date in WIB (YYYY-MM-DD) — determines which day the expense appears under. */
  expenseDate: string;
  createdByName: string;
  createdAt: string;
}

export interface ExpensePayload {
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export type { ApiError } from '../utils/apiError';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
