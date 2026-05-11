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
  is_active: boolean;
  created_at: string;
}

// ─── Location ─────────────────────────────────────────────────────────────────
export type LocationType = 'warehouse' | 'vehicle';

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  assigned_to?: string;
  assigned_to_name?: string;
  is_active: boolean;
  created_at: string;
}

// ─── Product ──────────────────────────────────────────────────────────────────
export type ProductCategory = 'simple' | 'refillable';
export type ProductionType = 'purchased' | 'self_produced';
export type ProductType = 'air' | 'gas';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  production_type?: ProductionType;
  type: ProductType;
  unit: string;
  base_price: number;
  is_active: boolean;
  created_at: string;
}

// ─── Customer ─────────────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  is_active: boolean;
  outstanding_debt?: number;
  created_at: string;
}

export interface CustomerPricingItem {
  product_id: string;
  product_name: string;
  base_price: number;
  custom_price?: number;
}

// ─── Stock ────────────────────────────────────────────────────────────────────
export type ContainerStatus = 'filled' | 'empty';
export type MovementType = 'receive' | 'transfer' | 'dispatch' | 'defect' | 'production' | 'vendor_exchange';

export interface StockLevel {
  product_id: string;
  product_name: string;
  product_unit: string;
  product_category: ProductCategory;
  location_id: string;
  location_name: string;
  /** null for simple products */
  quantity_filled: number | null;
  /** null for simple products */
  quantity_empty: number | null;
  /** null for refillable products */
  quantity_total: number | null;
}

export interface StockMovement {
  id: string;
  movement_type: MovementType;
  product_id: string;
  product_name: string;
  from_location_id?: string;
  from_location_name?: string;
  to_location_id?: string;
  to_location_name?: string;
  quantity: number;
  container_status?: ContainerStatus;
  purchase_cost?: number;
  notes?: string;
  created_by_name: string;
  created_at: string;
}

// ─── Transaction ──────────────────────────────────────────────────────────────
export type TransactionType = 'delivery' | 'counter';
export type TransactionStatus = 'completed' | 'cancelled';

export interface TransactionItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  customer_id?: string;
  customer_name?: string;
  location_id?: string;
  location_name?: string;
  items: TransactionItem[];
  total_amount: number;
  paid_amount: number;
  payment_method?: 'cash' | 'transfer' | 'qris';
  notes?: string;
  status: TransactionStatus;
  created_by_name: string;
  created_at: string;
  completed_at?: string;
}

// ─── Delivery Assignment ─────────────────────────────────────────────────────
export type DeliveryAssignmentStatus = 'pending' | 'fulfilled' | 'cancelled';

export interface DeliveryAssignmentItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface DeliveryAssignment {
  id: string;
  kurir_id: string;
  kurir_name: string;
  customer_id: string;
  customer_name: string;
  items: DeliveryAssignmentItem[];
  notes?: string;
  status: DeliveryAssignmentStatus;
  created_by_name: string;
  created_at: string;
  transaction_id?: string;
}

// ─── Debt Payment ─────────────────────────────────────────────────────────────
export interface DebtPayment {
  id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
  transaction_id?: string;
  notes?: string;
  created_by_name: string;
  created_at: string;
}

// ─── Container Loan ───────────────────────────────────────────────────────────
export interface ContainerLoan {
  id: string;
  customer_id: string;
  customer_name: string;
  product_id: string;
  product_name: string;
  quantity: number;
  transaction_id?: string;
  notes?: string;
  created_by_name: string;
  created_at: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface WeeklyChartEntry {
  date: string; // YYYY-MM-DD
  revenue: number;
  transaction_count: number;
  purchase_cost: number;
}

export interface RecentTransaction {
  id: string;
  created_at: string;
  customer_name?: string;
  created_by_name: string;
  type: TransactionType;
  total_amount: number;
  paid_amount: number;
  status: TransactionStatus;
}

export interface CustomerDebtSummary {
  customer_id: string;
  customer_name: string;
  outstanding_debt: number;
}

export interface DashboardStats {
  today_revenue: number;
  today_transactions: number;
  today_purchase_cost: number;
  today_debt_collected: number;
  low_stock_count: number;
  total_outstanding_debt: number;
  previous_day_revenue: number;
  weekly_chart: WeeklyChartEntry[];
  recent_transactions: RecentTransaction[];
  warehouse_stock: StockLevel[];
  customer_debts: CustomerDebtSummary[];
}

// ─── Debt History ─────────────────────────────────────────────────────────────
/** A transaction that created or partially created debt for a customer */
export interface DebtTransaction {
  id: string;
  created_at: string;
  type: TransactionType;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  created_by_name: string;
}

export interface CustomerDebtHistory {
  customer_id: string;
  customer_name: string;
  outstanding_debt: number;
  debt_transactions: DebtTransaction[];
  payments: DebtPayment[];
}

// ─── Cash Flow ────────────────────────────────────────────────────────────────
export type CashFlowType = 'cash_in' | 'cash_out' | 'new_debt';
export type CashFlowCategory = 'sale_payment' | 'debt_payment' | 'stock_purchase' | 'debt_created';

export interface CashFlowEntry {
  id: string;
  flow_type: CashFlowType;
  category: CashFlowCategory;
  amount: number;
  description: string;
  reference_id?: string;
  created_by_name: string;
  created_at: string;
}

export interface CashFlowSummary {
  total_cash_in: number;
  total_cash_out: number;
  net_cash: number;
  total_new_debt: number;
  entries: CashFlowEntry[];
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
