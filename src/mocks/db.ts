/**
 * ─── MOCK DATABASE ─────────────────────────────────────────────────────────────
 * In-memory store used while the real API is not available.
 * To restore real API calls: set VITE_USE_MOCK=false in .env
 * and uncomment the apiClient lines in each service file.
 *
 * Test accounts:
 *   owner  / owner123   → full access (Dashboard, all menus)
 *   kurir1 / kurir123   → Transaksi, Stok, Pelanggan
 *   kasir1 / kasir123   → Transaksi, Pelanggan, Hutang
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  AuthUser, User, Location, Product, Customer, CustomerPricingItem,
  StockLevel, StockMovement, Transaction, DebtPayment, ContainerLoan, DashboardStats,
} from '../types';

// ─── Auth credentials ─────────────────────────────────────────────────────────
export const MOCK_AUTH_USERS: (AuthUser & { password: string })[] = [
  { id: 'user-1', name: 'Budi Santoso', username: 'owner',  role: 'owner', password: 'owner123' },
  { id: 'user-2', name: 'Andi Kurir',   username: 'kurir1', role: 'kurir', password: 'kurir123' },
  { id: 'user-3', name: 'Sari Kasir',   username: 'kasir1', role: 'kasir', password: 'kasir123' },
];

// ─── Mutable in-memory store ──────────────────────────────────────────────────
export const mockDb = {

  users: [
    { id: 'user-1', name: 'Budi Santoso', username: 'owner',  role: 'owner', is_active: true,  created_at: '2025-01-01T08:00:00.000Z' },
    { id: 'user-2', name: 'Andi Kurir',   username: 'kurir1', role: 'kurir', is_active: true,  created_at: '2025-01-02T08:00:00.000Z' },
    { id: 'user-3', name: 'Sari Kasir',   username: 'kasir1', role: 'kasir', is_active: true,  created_at: '2025-01-03T08:00:00.000Z' },
    { id: 'user-4', name: 'Rudi Kurir',   username: 'kurir2', role: 'kurir', is_active: true,  created_at: '2025-01-10T08:00:00.000Z' },
    { id: 'user-5', name: 'Nina Kasir',   username: 'kasir2', role: 'kasir', is_active: false, created_at: '2025-02-01T08:00:00.000Z' },
  ] as User[],

  locations: [
    { id: 'loc-1', name: 'Gudang Utama', type: 'warehouse', is_active: true,  created_at: '2025-01-01T08:00:00.000Z' },
    { id: 'loc-2', name: 'Truk Andi',    type: 'vehicle',   assigned_to: 'user-2', assigned_to_name: 'Andi Kurir',  is_active: true,  created_at: '2025-01-02T08:00:00.000Z' },
    { id: 'loc-3', name: 'Truk Rudi',    type: 'vehicle',   assigned_to: 'user-4', assigned_to_name: 'Rudi Kurir',  is_active: true,  created_at: '2025-01-10T08:00:00.000Z' },
  ] as Location[],

  products: [
    { id: 'prod-1', name: 'Galon Aqua',           category: 'refillable', production_type: 'purchased',     type: 'air', unit: 'galon',      base_price: 5000,  is_active: true,  created_at: '2025-01-01T08:00:00.000Z' },
    { id: 'prod-2', name: 'Galon Vit',            category: 'refillable', production_type: 'purchased',     type: 'air', unit: 'galon',      base_price: 4800,  is_active: true,  created_at: '2025-01-01T08:00:00.000Z' },
    { id: 'prod-3', name: 'Galon Isi Ulang',      category: 'refillable', production_type: 'self_produced', type: 'air', unit: 'galon',      base_price: 3000,  is_active: true,  created_at: '2025-01-01T08:00:00.000Z' },
    { id: 'prod-4', name: 'Gas LPG 3 kg',         category: 'refillable', production_type: 'purchased',     type: 'gas', unit: 'tabung 3kg',  base_price: 20000, is_active: true,  created_at: '2025-01-01T08:00:00.000Z' },
    { id: 'prod-5', name: 'Gas LPG 12 kg',        category: 'refillable', production_type: 'purchased',     type: 'gas', unit: 'tabung 12kg', base_price: 85000, is_active: true,  created_at: '2025-01-01T08:00:00.000Z' },
    { id: 'prod-6', name: 'Air Isi Ulang 240ml',  category: 'simple',     production_type: undefined,       type: 'air', unit: 'cup',         base_price: 500,   is_active: true,  created_at: '2025-01-01T08:00:00.000Z' },
  ] as Product[],

  customers: [
    { id: 'cust-1', name: 'Toko Bu Ani',      phone: '08121234567', address: 'Jl. Mawar No. 1, Jakarta',    is_active: true,  outstanding_debt: 50000,  created_at: '2025-01-05T08:00:00.000Z' },
    { id: 'cust-2', name: 'Warung Pak Joko',  phone: '08129876543', address: 'Jl. Melati No. 5, Jakarta',   is_active: true,  outstanding_debt: 20000,  created_at: '2025-01-06T08:00:00.000Z' },
    { id: 'cust-3', name: 'Restoran Sedap',   phone: '0812111222',  address: 'Jl. Kenanga No. 10, Bandung', is_active: true,  outstanding_debt: 125000, created_at: '2025-01-10T08:00:00.000Z' },
    { id: 'cust-4', name: 'Toko Lama Tutup',  phone: undefined,     address: 'Jl. Lama No. 99',             is_active: false, outstanding_debt: 0,      created_at: '2024-12-01T08:00:00.000Z' },
  ] as Customer[],

  customerPricing: {
    'cust-1': [
      { product_id: 'prod-1', product_name: 'Galon Aqua',          base_price: 5000,  custom_price: 4500  },
      { product_id: 'prod-2', product_name: 'Galon Vit',           base_price: 4800,  custom_price: undefined },
      { product_id: 'prod-3', product_name: 'Galon Isi Ulang',     base_price: 3000,  custom_price: 2800  },
      { product_id: 'prod-4', product_name: 'Gas LPG 3 kg',        base_price: 20000, custom_price: undefined },
      { product_id: 'prod-5', product_name: 'Gas LPG 12 kg',       base_price: 85000, custom_price: undefined },
      { product_id: 'prod-6', product_name: 'Air Isi Ulang 240ml', base_price: 500,   custom_price: undefined },
    ],
    'cust-2': [
      { product_id: 'prod-1', product_name: 'Galon Aqua',          base_price: 5000,  custom_price: undefined },
      { product_id: 'prod-2', product_name: 'Galon Vit',           base_price: 4800,  custom_price: undefined },
      { product_id: 'prod-3', product_name: 'Galon Isi Ulang',     base_price: 3000,  custom_price: undefined },
      { product_id: 'prod-4', product_name: 'Gas LPG 3 kg',        base_price: 20000, custom_price: 18000 },
      { product_id: 'prod-5', product_name: 'Gas LPG 12 kg',       base_price: 85000, custom_price: undefined },
      { product_id: 'prod-6', product_name: 'Air Isi Ulang 240ml', base_price: 500,   custom_price: undefined },
    ],
    'cust-3': [
      { product_id: 'prod-1', product_name: 'Galon Aqua',          base_price: 5000,  custom_price: undefined },
      { product_id: 'prod-2', product_name: 'Galon Vit',           base_price: 4800,  custom_price: undefined },
      { product_id: 'prod-3', product_name: 'Galon Isi Ulang',     base_price: 3000,  custom_price: undefined },
      { product_id: 'prod-4', product_name: 'Gas LPG 3 kg',        base_price: 20000, custom_price: undefined },
      { product_id: 'prod-5', product_name: 'Gas LPG 12 kg',       base_price: 85000, custom_price: 80000 },
      { product_id: 'prod-6', product_name: 'Air Isi Ulang 240ml', base_price: 500,   custom_price: undefined },
    ],
  } as Record<string, CustomerPricingItem[]>,

  stockLevels: [
    // Gudang Utama
    { product_id: 'prod-1', product_name: 'Galon Aqua',          product_unit: 'galon',      product_category: 'refillable', location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: 50, quantity_empty: 10, quantity_total: null },
    { product_id: 'prod-2', product_name: 'Galon Vit',           product_unit: 'galon',      product_category: 'refillable', location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: 30, quantity_empty: 15, quantity_total: null },
    { product_id: 'prod-3', product_name: 'Galon Isi Ulang',     product_unit: 'galon',      product_category: 'refillable', location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: 20, quantity_empty: 8,  quantity_total: null },
    { product_id: 'prod-4', product_name: 'Gas LPG 3 kg',        product_unit: 'tabung 3kg', product_category: 'refillable', location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: 30, quantity_empty: 5,  quantity_total: null },
    { product_id: 'prod-5', product_name: 'Gas LPG 12 kg',       product_unit: 'tabung 12kg',product_category: 'refillable', location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: 15, quantity_empty: 2,  quantity_total: null },
    { product_id: 'prod-6', product_name: 'Air Isi Ulang 240ml', product_unit: 'cup',        product_category: 'simple',     location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: null, quantity_empty: null, quantity_total: 200 },
    // Truk Andi
    { product_id: 'prod-1', product_name: 'Galon Aqua',          product_unit: 'galon',      product_category: 'refillable', location_id: 'loc-2', location_name: 'Truk Andi', quantity_filled: 20, quantity_empty: 5,  quantity_total: null },
    { product_id: 'prod-2', product_name: 'Galon Vit',           product_unit: 'galon',      product_category: 'refillable', location_id: 'loc-2', location_name: 'Truk Andi', quantity_filled: 10, quantity_empty: 3,  quantity_total: null },
    { product_id: 'prod-4', product_name: 'Gas LPG 3 kg',        product_unit: 'tabung 3kg', product_category: 'refillable', location_id: 'loc-2', location_name: 'Truk Andi', quantity_filled: 10, quantity_empty: 0,  quantity_total: null },
    // Truk Rudi
    { product_id: 'prod-4', product_name: 'Gas LPG 3 kg',        product_unit: 'tabung 3kg', product_category: 'refillable', location_id: 'loc-3', location_name: 'Truk Rudi', quantity_filled: 8,  quantity_empty: 0,  quantity_total: null },
    { product_id: 'prod-5', product_name: 'Gas LPG 12 kg',       product_unit: 'tabung 12kg',product_category: 'refillable', location_id: 'loc-3', location_name: 'Truk Rudi', quantity_filled: 5,  quantity_empty: 1,  quantity_total: null },
  ] as StockLevel[],

  stockMovements: [
    { id: 'mov-1', movement_type: 'receive',   product_id: 'prod-1', product_name: 'Galon Aqua',    to_location_id: 'loc-1', to_location_name: 'Gudang Utama', quantity: 50, container_status: 'filled', purchase_cost: 250000,  notes: 'Terima dari supplier', created_by_name: 'Budi Santoso', created_at: '2025-04-01T08:00:00.000Z' },
    { id: 'mov-2', movement_type: 'transfer',  product_id: 'prod-1', product_name: 'Galon Aqua',    from_location_id: 'loc-1', from_location_name: 'Gudang Utama', to_location_id: 'loc-2', to_location_name: 'Truk Andi', quantity: 20, container_status: 'filled', created_by_name: 'Budi Santoso', created_at: '2025-04-02T07:00:00.000Z' },
    { id: 'mov-3', movement_type: 'transfer',  product_id: 'prod-4', product_name: 'Gas LPG 3 kg',  from_location_id: 'loc-1', from_location_name: 'Gudang Utama', to_location_id: 'loc-2', to_location_name: 'Truk Andi', quantity: 10, container_status: 'filled', created_by_name: 'Andi Kurir',   created_at: '2025-04-02T07:10:00.000Z' },
    { id: 'mov-4', movement_type: 'receive',   product_id: 'prod-5', product_name: 'Gas LPG 12 kg', to_location_id: 'loc-1', to_location_name: 'Gudang Utama', quantity: 15, container_status: 'filled', purchase_cost: 1275000, notes: 'Restock bulanan',      created_by_name: 'Budi Santoso', created_at: '2025-04-03T09:00:00.000Z' },
    { id: 'mov-5', movement_type: 'defect',    product_id: 'prod-4', product_name: 'Gas LPG 3 kg',  from_location_id: 'loc-3', from_location_name: 'Truk Rudi', quantity: 2, container_status: 'filled', notes: 'Tabung bocor saat pengiriman', created_by_name: 'Rudi Kurir',   created_at: '2025-04-05T14:30:00.000Z' },
    { id: 'mov-6', movement_type: 'production',product_id: 'prod-3', product_name: 'Galon Isi Ulang', from_location_id: 'loc-1', from_location_name: 'Gudang Utama', quantity: 10, container_status: 'filled', purchase_cost: 30000,   notes: '[Produksi] Isi ulang 10 galon', created_by_name: 'Budi Santoso', created_at: '2025-04-06T09:00:00.000Z' },
    // Delivery tx-6: Andi antar 10 Galon Aqua ke Bu Ani, terima 20 galon kosong
    { id: 'mov-7', movement_type: 'dispatch',   product_id: 'prod-1', product_name: 'Galon Aqua', from_location_id: 'loc-2', from_location_name: 'Truk Andi', quantity: 10, container_status: 'filled', notes: 'Penjualan tx-6 — Toko Bu Ani', created_by_name: 'Andi Kurir', created_at: '2026-05-10T09:30:00.000Z' },
    { id: 'mov-8', movement_type: 'receive',    product_id: 'prod-1', product_name: 'Galon Aqua', to_location_id: 'loc-2', to_location_name: 'Truk Andi', quantity: 20, container_status: 'empty',  notes: 'Kontainer kosong diterima dari Toko Bu Ani (tx-6)', created_by_name: 'Andi Kurir', created_at: '2026-05-10T09:35:00.000Z' },
    // Delivery tx-7: Andi antar 20 Galon Aqua ke Pak Joko, terima 10 galon kosong
    { id: 'mov-9', movement_type: 'dispatch',   product_id: 'prod-1', product_name: 'Galon Aqua', from_location_id: 'loc-2', from_location_name: 'Truk Andi', quantity: 20, container_status: 'filled', notes: 'Penjualan tx-7 — Warung Pak Joko', created_by_name: 'Andi Kurir', created_at: '2026-05-10T11:00:00.000Z' },
    { id: 'mov-10', movement_type: 'receive',   product_id: 'prod-1', product_name: 'Galon Aqua', to_location_id: 'loc-2', to_location_name: 'Truk Andi', quantity: 10, container_status: 'empty',  notes: 'Kontainer kosong diterima dari Warung Pak Joko (tx-7)', created_by_name: 'Andi Kurir', created_at: '2026-05-10T11:05:00.000Z' },
  ] as StockMovement[],

  transactions: [
    {
      id: 'tx-1', type: 'delivery',
      customer_id: 'cust-1', customer_name: 'Toko Bu Ani',
      location_id: 'loc-2', location_name: 'Truk Andi',
      items: [{ product_id: 'prod-1', product_name: 'Galon Aqua', quantity: 3, unit_price: 4500, subtotal: 13500 }],
      total_amount: 13500, paid_amount: 13500, status: 'completed',
      created_by_name: 'Andi Kurir', created_at: '2025-04-10T09:00:00.000Z', completed_at: '2025-04-10T10:00:00.000Z',
    },
    {
      id: 'tx-2', type: 'counter',
      customer_id: 'cust-2', customer_name: 'Warung Pak Joko',
      location_id: 'loc-1', location_name: 'Gudang Utama',
      items: [{ product_id: 'prod-4', product_name: 'Gas LPG 3 kg', quantity: 2, unit_price: 20000, subtotal: 40000 }],
      total_amount: 40000, paid_amount: 20000, status: 'completed',
      created_by_name: 'Sari Kasir', created_at: '2025-04-11T10:00:00.000Z',
    },
    {
      id: 'tx-3', type: 'delivery',
      customer_id: 'cust-3', customer_name: 'Restoran Sedap',
      location_id: 'loc-3', location_name: 'Truk Rudi',
      items: [
        { product_id: 'prod-5', product_name: 'Gas LPG 12 kg', quantity: 1, unit_price: 85000, subtotal: 85000 },
        { product_id: 'prod-4', product_name: 'Gas LPG 3 kg',  quantity: 2, unit_price: 20000, subtotal: 40000 },
      ],
      total_amount: 125000, paid_amount: 0, status: 'completed',
      created_by_name: 'Rudi Kurir', created_at: '2025-04-12T08:00:00.000Z',
    },
    {
      id: 'tx-4', type: 'counter',
      location_id: 'loc-1', location_name: 'Gudang Utama',
      items: [{ product_id: 'prod-6', product_name: 'Air Isi Ulang 240ml', quantity: 10, unit_price: 500, subtotal: 5000 }],
      total_amount: 5000, paid_amount: 5000, status: 'completed',
      created_by_name: 'Sari Kasir', created_at: '2025-04-13T11:00:00.000Z', completed_at: '2025-04-13T11:00:00.000Z',
    },
    {
      id: 'tx-5', type: 'counter',
      customer_id: 'cust-1', customer_name: 'Toko Bu Ani',
      location_id: 'loc-1', location_name: 'Gudang Utama',
      items: [{ product_id: 'prod-4', product_name: 'Gas LPG 3 kg', quantity: 5, unit_price: 20000, subtotal: 100000 }],
      total_amount: 100000, paid_amount: 100000, status: 'completed',
      created_by_name: 'Budi Santoso', created_at: '2025-04-14T15:00:00.000Z', completed_at: '2025-04-14T15:00:00.000Z',
    },
    {
      // Kasus 1: Andi antar 10 Galon Aqua ke Bu Ani, Bu Ani kembalikan 20 galon kosong
      // Net Bu Ani (prod-1): loan-1(+3) + loan-3(+10) + loan-4(-20) = -7
      // Artinya: kita memegang 7 galon milik Bu Ani di truk, harus dikembalikan terisi
      id: 'tx-6', type: 'delivery',
      customer_id: 'cust-1', customer_name: 'Toko Bu Ani',
      location_id: 'loc-2', location_name: 'Truk Andi',
      items: [{ product_id: 'prod-1', product_name: 'Galon Aqua', quantity: 10, unit_price: 4500, subtotal: 45000 }],
      total_amount: 45000, paid_amount: 45000, status: 'completed',
      created_by_name: 'Andi Kurir', created_at: '2026-05-10T09:30:00.000Z', completed_at: '2026-05-10T09:30:00.000Z',
    },
    {
      // Kasus 2: Andi antar 20 Galon Aqua ke Pak Joko, Pak Joko kembalikan 10 galon kosong
      // Net Pak Joko (prod-1): loan-5(+20) + loan-6(-10) = +10
      // Artinya: Pak Joko masih memegang 10 galon milik kita yang belum dikembalikan
      id: 'tx-7', type: 'delivery',
      customer_id: 'cust-2', customer_name: 'Warung Pak Joko',
      location_id: 'loc-2', location_name: 'Truk Andi',
      items: [{ product_id: 'prod-1', product_name: 'Galon Aqua', quantity: 20, unit_price: 5000, subtotal: 100000 }],
      total_amount: 100000, paid_amount: 100000, status: 'completed',
      created_by_name: 'Andi Kurir', created_at: '2026-05-10T11:00:00.000Z', completed_at: '2026-05-10T11:00:00.000Z',
    },
  ] as Transaction[],

  debtPayments: [
    { id: 'debt-1', customer_id: 'cust-1', customer_name: 'Toko Bu Ani',     amount: 25000,  notes: 'Bayar sebagian',          created_by_name: 'Sari Kasir',   created_at: '2025-04-08T10:00:00.000Z' },
    { id: 'debt-2', customer_id: 'cust-3', customer_name: 'Restoran Sedap',  amount: 100000, notes: 'DP cicilan bulan ini',     created_by_name: 'Budi Santoso', created_at: '2025-04-09T14:00:00.000Z' },
    { id: 'debt-3', customer_id: 'cust-1', customer_name: 'Toko Bu Ani',     amount: 10000,  notes: 'Bayar sisa transaksi lama', created_by_name: 'Sari Kasir',  created_at: '2025-04-15T09:00:00.000Z' },
  ] as DebtPayment[],

  containerLoans: [
    { id: 'loan-1', customer_id: 'cust-1', customer_name: 'Toko Bu Ani',    product_id: 'prod-1', product_name: 'Galon Aqua',    quantity:  3, notes: 'Pinjam galon cadangan',    created_by_name: 'Sari Kasir',   created_at: '2025-04-01T08:00:00.000Z' },
    { id: 'loan-2', customer_id: 'cust-3', customer_name: 'Restoran Sedap', product_id: 'prod-4', product_name: 'Gas LPG 3 kg',  quantity:  5, notes: 'Tabung cadangan restoran', created_by_name: 'Budi Santoso', created_at: '2025-04-05T10:00:00.000Z' },
    // tx-6: Andi antar 10 Galon Aqua ke Bu Ani, terima 20 galon kosong
    { id: 'loan-3', customer_id: 'cust-1', customer_name: 'Toko Bu Ani',    product_id: 'prod-1', product_name: 'Galon Aqua', quantity: +10, transaction_id: 'tx-6', notes: 'Antar 10 galon terisi',              created_by_name: 'Andi Kurir', created_at: '2025-04-20T09:30:00.000Z' },
    { id: 'loan-4', customer_id: 'cust-1', customer_name: 'Toko Bu Ani',    product_id: 'prod-1', product_name: 'Galon Aqua', quantity: -20, transaction_id: 'tx-6', notes: 'Terima 20 galon kosong dari Bu Ani', created_by_name: 'Andi Kurir', created_at: '2025-04-20T09:35:00.000Z' },
    // tx-7: Andi antar 20 Galon Aqua ke Pak Joko, terima 10 galon kosong
    { id: 'loan-5', customer_id: 'cust-2', customer_name: 'Warung Pak Joko', product_id: 'prod-1', product_name: 'Galon Aqua', quantity: +20, transaction_id: 'tx-7', notes: 'Antar 20 galon terisi',               created_by_name: 'Andi Kurir', created_at: '2025-04-20T11:00:00.000Z' },
    { id: 'loan-6', customer_id: 'cust-2', customer_name: 'Warung Pak Joko', product_id: 'prod-1', product_name: 'Galon Aqua', quantity: -10, transaction_id: 'tx-7', notes: 'Terima 10 galon kosong dari Pak Joko', created_by_name: 'Andi Kurir', created_at: '2025-04-20T11:05:00.000Z' },
  ] as ContainerLoan[],

  dashboardStats: {
    today_revenue: 118500,
    today_transactions: 5,
    today_purchase_cost: 1525000,
    today_debt_collected: 135000,
    low_stock_count: 2,
    total_outstanding_debt: 195000,
    previous_day_revenue: 430000,
    weekly_chart: [
      { date: '2026-05-03', revenue:  95000, transaction_count: 3,  purchase_cost:  280000 },
      { date: '2026-05-04', revenue: 210000, transaction_count: 8,  purchase_cost:  620000 },
      { date: '2026-05-05', revenue: 175000, transaction_count: 6,  purchase_cost:  510000 },
      { date: '2026-05-06', revenue: 340000, transaction_count: 12, purchase_cost:  980000 },
      { date: '2026-05-07', revenue: 280000, transaction_count: 10, purchase_cost:  750000 },
      { date: '2026-05-08', revenue: 430000, transaction_count: 15, purchase_cost: 1525000 },
      { date: '2026-05-09', revenue: 118500, transaction_count: 5,  purchase_cost: 1525000 },
    ],
    recent_transactions: [
      { id: 'tx-7', created_at: '2025-04-20T11:00:00.000Z', customer_name: 'Warung Pak Joko', created_by_name: 'Andi Kurir',   type: 'delivery', total_amount: 100000, paid_amount: 100000, status: 'completed' },
      { id: 'tx-6', created_at: '2025-04-20T09:30:00.000Z', customer_name: 'Toko Bu Ani',     created_by_name: 'Andi Kurir',   type: 'delivery', total_amount:  45000, paid_amount:  45000, status: 'completed' },
      { id: 'tx-5', created_at: '2025-04-14T15:00:00.000Z', customer_name: 'Toko Bu Ani',     created_by_name: 'Budi Santoso', type: 'counter',  total_amount: 100000, paid_amount: 100000, status: 'completed' },
      { id: 'tx-4', created_at: '2025-04-13T11:00:00.000Z', customer_name: undefined,          created_by_name: 'Sari Kasir',   type: 'counter',  total_amount:   5000, paid_amount:   5000, status: 'completed' },
      { id: 'tx-3', created_at: '2025-04-12T08:00:00.000Z', customer_name: 'Restoran Sedap',  created_by_name: 'Rudi Kurir',   type: 'delivery', total_amount: 125000, paid_amount:      0, status: 'completed' },
      { id: 'tx-2', created_at: '2025-04-11T10:00:00.000Z', customer_name: 'Warung Pak Joko', created_by_name: 'Sari Kasir',   type: 'counter',  total_amount:  40000, paid_amount:  20000, status: 'completed' },
      { id: 'tx-1', created_at: '2025-04-10T09:00:00.000Z', customer_name: 'Toko Bu Ani',     created_by_name: 'Andi Kurir',   type: 'delivery', total_amount:  13500, paid_amount:  13500, status: 'completed' },
    ],
    warehouse_stock: [
      { product_id: 'prod-1', product_name: 'Galon Aqua',          product_unit: 'galon',       product_category: 'refillable', location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: 50,   quantity_empty: 10,   quantity_total: null },
      { product_id: 'prod-2', product_name: 'Galon Vit',           product_unit: 'galon',       product_category: 'refillable', location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: 30,   quantity_empty: 15,   quantity_total: null },
      { product_id: 'prod-3', product_name: 'Galon Isi Ulang',     product_unit: 'galon',       product_category: 'refillable', location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: 4,    quantity_empty: 8,    quantity_total: null },
      { product_id: 'prod-4', product_name: 'Gas LPG 3 kg',        product_unit: 'tabung 3kg',  product_category: 'refillable', location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: 30,   quantity_empty: 5,    quantity_total: null },
      { product_id: 'prod-5', product_name: 'Gas LPG 12 kg',       product_unit: 'tabung 12kg', product_category: 'refillable', location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: 3,    quantity_empty: 2,    quantity_total: null },
      { product_id: 'prod-6', product_name: 'Air Isi Ulang 240ml', product_unit: 'cup',         product_category: 'simple',     location_id: 'loc-1', location_name: 'Gudang Utama', quantity_filled: null, quantity_empty: null, quantity_total: 200  },
    ],
  } as DashboardStats,
};

/** Generate a simple unique ID for new mock records. */
export function uid(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Simulate a short network delay so UI feedback (spinners) is visible. */
export function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
