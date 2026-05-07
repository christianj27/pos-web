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
export type MovementType = 'receive' | 'transfer' | 'defect';

export interface StockLevel {
  product_id: string;
  product_name: string;
  product_unit: string;
  location_id: string;
  location_name: string;
  quantity: number;
  container_status?: ContainerStatus;
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
export type TransactionType = 'delivery' | 'counter' | 'vendor_direct';
export type TransactionStatus = 'pending' | 'completed' | 'cancelled';

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
  status: TransactionStatus;
  created_by_name: string;
  created_at: string;
  completed_at?: string;
}

// ─── Debt Payment ─────────────────────────────────────────────────────────────
export interface DebtPayment {
  id: string;
  customer_id: string;
  customer_name: string;
  amount: number;
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
  notes?: string;
  created_by_name: string;
  created_at: string;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardStats {
  today_revenue: number;
  today_transactions: number;
  today_purchase_cost: number;
  total_outstanding_debt: number;
  pending_deliveries: number;
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
