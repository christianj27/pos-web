/**
 * ─── MOCK DATABASE ─────────────────────────────────────────────────────────────
 * In-memory store used while the real API is not available.
 * To switch between mock and real API, set VITE_USE_MOCK in .env.local:
 *   VITE_USE_MOCK=true  → uses in-memory mock data (default for development)
 *   VITE_USE_MOCK=false → calls the real backend API
 *
 * Test accounts (mock mode only):
 *   owner  / owner123   → full access (Dashboard, all menus)
 *   kurir1 / kurir123   → Transaksi, Stok, Pelanggan
 *   kasir1 / kasir123   → Transaksi, Pelanggan, Hutang
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

import type {
  AuthUser, User, Location, Product, Customer, CustomerPricingItem,
  StockLevel, StockMovement, Transaction, DebtPayment, ContainerLoan, DashboardStats,
  DeliveryAssignment,
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
    { id: 'user-1', name: 'Budi Santoso', username: 'owner',  role: 'owner', isActive: true,  createdAt: '2025-01-01T08:00:00.000Z' },
    { id: 'user-2', name: 'Andi Kurir',   username: 'kurir1', role: 'kurir', isActive: true,  createdAt: '2025-01-02T08:00:00.000Z' },
    { id: 'user-3', name: 'Sari Kasir',   username: 'kasir1', role: 'kasir', isActive: true,  createdAt: '2025-01-03T08:00:00.000Z' },
    { id: 'user-4', name: 'Rudi Kurir',   username: 'kurir2', role: 'kurir', isActive: true,  createdAt: '2025-01-10T08:00:00.000Z' },
    { id: 'user-5', name: 'Nina Kasir',   username: 'kasir2', role: 'kasir', isActive: false, createdAt: '2025-02-01T08:00:00.000Z' },
  ] as User[],

  locations: [
    { id: 'loc-1', name: 'Gudang Utama', type: 'warehouse', isActive: true,  createdAt: '2025-01-01T08:00:00.000Z' },
    { id: 'loc-2', name: 'Truk Andi',    type: 'vehicle',   assignedTo: 'user-2', assignedToName: 'Andi Kurir',  isActive: true,  createdAt: '2025-01-02T08:00:00.000Z' },
    { id: 'loc-3', name: 'Truk Rudi',    type: 'vehicle',   assignedTo: 'user-4', assignedToName: 'Rudi Kurir',  isActive: true,  createdAt: '2025-01-10T08:00:00.000Z' },
  ] as Location[],

  products: [
    { id: 'prod-1', name: 'Galon Aqua',           category: 'refillable', productionType: 'purchased',     type: 'air', unit: 'galon',      basePrice: 5000,  isActive: true,  createdAt: '2025-01-01T08:00:00.000Z' },
    { id: 'prod-2', name: 'Galon Vit',            category: 'refillable', productionType: 'purchased',     type: 'air', unit: 'galon',      basePrice: 4800,  isActive: true,  createdAt: '2025-01-01T08:00:00.000Z' },
    { id: 'prod-3', name: 'Galon Isi Ulang',      category: 'refillable', productionType: 'self_produced', type: 'air', unit: 'galon',      basePrice: 3000,  isActive: true,  createdAt: '2025-01-01T08:00:00.000Z' },
    { id: 'prod-4', name: 'Gas LPG 3 kg',         category: 'refillable', productionType: 'purchased',     type: 'gas', unit: 'tabung 3kg',  basePrice: 20000, isActive: true,  createdAt: '2025-01-01T08:00:00.000Z' },
    { id: 'prod-5', name: 'Gas LPG 12 kg',        category: 'refillable', productionType: 'purchased',     type: 'gas', unit: 'tabung 12kg', basePrice: 85000, isActive: true,  createdAt: '2025-01-01T08:00:00.000Z' },
    { id: 'prod-6', name: 'Air Isi Ulang 240ml',  category: 'simple',     productionType: undefined,       type: 'air', unit: 'cup',         basePrice: 500,   isActive: true,  createdAt: '2025-01-01T08:00:00.000Z' },
  ] as Product[],

  customers: [
    { id: 'cust-1', name: 'Toko Bu Ani',      phone: '08121234567', address: 'Jl. Mawar No. 1, Jakarta',    isActive: true,  outstandingDebt: 50000,  createdAt: '2025-01-05T08:00:00.000Z' },
    { id: 'cust-2', name: 'Warung Pak Joko',  phone: '08129876543', address: 'Jl. Melati No. 5, Jakarta',   isActive: true,  outstandingDebt: 20000,  createdAt: '2025-01-06T08:00:00.000Z' },
    { id: 'cust-3', name: 'Restoran Sedap',   phone: '0812111222',  address: 'Jl. Kenanga No. 10, Bandung', isActive: true,  outstandingDebt: 125000, createdAt: '2025-01-10T08:00:00.000Z' },
    { id: 'cust-4', name: 'Toko Lama Tutup',  phone: undefined,     address: 'Jl. Lama No. 99',             isActive: false, outstandingDebt: 0,      createdAt: '2024-12-01T08:00:00.000Z' },
  ] as Customer[],

  customerPricing: {
    'cust-1': [
      { productId: 'prod-1', productName: 'Galon Aqua',          basePrice: 5000,  customPrice: 4500  },
      { productId: 'prod-2', productName: 'Galon Vit',           basePrice: 4800,  customPrice: undefined },
      { productId: 'prod-3', productName: 'Galon Isi Ulang',     basePrice: 3000,  customPrice: 2800  },
      { productId: 'prod-4', productName: 'Gas LPG 3 kg',        basePrice: 20000, customPrice: undefined },
      { productId: 'prod-5', productName: 'Gas LPG 12 kg',       basePrice: 85000, customPrice: undefined },
      { productId: 'prod-6', productName: 'Air Isi Ulang 240ml', basePrice: 500,   customPrice: undefined },
    ],
    'cust-2': [
      { productId: 'prod-1', productName: 'Galon Aqua',          basePrice: 5000,  customPrice: undefined },
      { productId: 'prod-2', productName: 'Galon Vit',           basePrice: 4800,  customPrice: undefined },
      { productId: 'prod-3', productName: 'Galon Isi Ulang',     basePrice: 3000,  customPrice: undefined },
      { productId: 'prod-4', productName: 'Gas LPG 3 kg',        basePrice: 20000, customPrice: 18000 },
      { productId: 'prod-5', productName: 'Gas LPG 12 kg',       basePrice: 85000, customPrice: undefined },
      { productId: 'prod-6', productName: 'Air Isi Ulang 240ml', basePrice: 500,   customPrice: undefined },
    ],
    'cust-3': [
      { productId: 'prod-1', productName: 'Galon Aqua',          basePrice: 5000,  customPrice: undefined },
      { productId: 'prod-2', productName: 'Galon Vit',           basePrice: 4800,  customPrice: undefined },
      { productId: 'prod-3', productName: 'Galon Isi Ulang',     basePrice: 3000,  customPrice: undefined },
      { productId: 'prod-4', productName: 'Gas LPG 3 kg',        basePrice: 20000, customPrice: undefined },
      { productId: 'prod-5', productName: 'Gas LPG 12 kg',       basePrice: 85000, customPrice: 80000 },
      { productId: 'prod-6', productName: 'Air Isi Ulang 240ml', basePrice: 500,   customPrice: undefined },
    ],
  } as Record<string, CustomerPricingItem[]>,

  stockLevels: [
    // Gudang Utama
    { productId: 'prod-1', productName: 'Galon Aqua',          productUnit: 'galon',      productCategory: 'refillable', locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: 50, quantityEmpty: 10, quantityTotal: null },
    { productId: 'prod-2', productName: 'Galon Vit',           productUnit: 'galon',      productCategory: 'refillable', locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: 30, quantityEmpty: 15, quantityTotal: null },
    { productId: 'prod-3', productName: 'Galon Isi Ulang',     productUnit: 'galon',      productCategory: 'refillable', locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: 20, quantityEmpty: 8,  quantityTotal: null },
    { productId: 'prod-4', productName: 'Gas LPG 3 kg',        productUnit: 'tabung 3kg', productCategory: 'refillable', locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: 30, quantityEmpty: 5,  quantityTotal: null },
    { productId: 'prod-5', productName: 'Gas LPG 12 kg',       productUnit: 'tabung 12kg',productCategory: 'refillable', locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: 15, quantityEmpty: 2,  quantityTotal: null },
    { productId: 'prod-6', productName: 'Air Isi Ulang 240ml', productUnit: 'cup',        productCategory: 'simple',     locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: null, quantityEmpty: null, quantityTotal: 200 },
    // Truk Andi
    { productId: 'prod-1', productName: 'Galon Aqua',          productUnit: 'galon',      productCategory: 'refillable', locationId: 'loc-2', locationName: 'Truk Andi', quantityFilled: 20, quantityEmpty: 5,  quantityTotal: null },
    { productId: 'prod-2', productName: 'Galon Vit',           productUnit: 'galon',      productCategory: 'refillable', locationId: 'loc-2', locationName: 'Truk Andi', quantityFilled: 10, quantityEmpty: 3,  quantityTotal: null },
    { productId: 'prod-4', productName: 'Gas LPG 3 kg',        productUnit: 'tabung 3kg', productCategory: 'refillable', locationId: 'loc-2', locationName: 'Truk Andi', quantityFilled: 10, quantityEmpty: 0,  quantityTotal: null },
    // Truk Rudi
    { productId: 'prod-4', productName: 'Gas LPG 3 kg',        productUnit: 'tabung 3kg', productCategory: 'refillable', locationId: 'loc-3', locationName: 'Truk Rudi', quantityFilled: 8,  quantityEmpty: 0,  quantityTotal: null },
    { productId: 'prod-5', productName: 'Gas LPG 12 kg',       productUnit: 'tabung 12kg',productCategory: 'refillable', locationId: 'loc-3', locationName: 'Truk Rudi', quantityFilled: 5,  quantityEmpty: 1,  quantityTotal: null },
  ] as StockLevel[],

  stockMovements: [
    { id: 'mov-1', movementType: 'receive',   productId: 'prod-1', productName: 'Galon Aqua',    toLocationId: 'loc-1', toLocationName: 'Gudang Utama', quantity: 50, containerStatus: 'filled', purchaseCost: 250000,  notes: 'Terima dari supplier', createdByName: 'Budi Santoso', createdAt: '2025-04-01T08:00:00.000Z' },
    { id: 'mov-2', movementType: 'transfer',  productId: 'prod-1', productName: 'Galon Aqua',    fromLocationId: 'loc-1', fromLocationName: 'Gudang Utama', toLocationId: 'loc-2', toLocationName: 'Truk Andi', quantity: 20, containerStatus: 'filled', createdByName: 'Budi Santoso', createdAt: '2025-04-02T07:00:00.000Z' },
    { id: 'mov-3', movementType: 'transfer',  productId: 'prod-4', productName: 'Gas LPG 3 kg',  fromLocationId: 'loc-1', fromLocationName: 'Gudang Utama', toLocationId: 'loc-2', toLocationName: 'Truk Andi', quantity: 10, containerStatus: 'filled', createdByName: 'Andi Kurir',   createdAt: '2025-04-02T07:10:00.000Z' },
    { id: 'mov-4', movementType: 'receive',   productId: 'prod-5', productName: 'Gas LPG 12 kg', toLocationId: 'loc-1', toLocationName: 'Gudang Utama', quantity: 15, containerStatus: 'filled', purchaseCost: 1275000, notes: 'Restock bulanan',      createdByName: 'Budi Santoso', createdAt: '2025-04-03T09:00:00.000Z' },
    { id: 'mov-5', movementType: 'defect',    productId: 'prod-4', productName: 'Gas LPG 3 kg',  fromLocationId: 'loc-3', fromLocationName: 'Truk Rudi', quantity: 2, containerStatus: 'filled', notes: 'Tabung bocor saat pengiriman', createdByName: 'Rudi Kurir',   createdAt: '2025-04-05T14:30:00.000Z' },
    { id: 'mov-6', movementType: 'production',productId: 'prod-3', productName: 'Galon Isi Ulang', fromLocationId: 'loc-1', fromLocationName: 'Gudang Utama', quantity: 10, containerStatus: 'filled', purchaseCost: 30000,   notes: '[Produksi] Isi ulang 10 galon', createdByName: 'Budi Santoso', createdAt: '2025-04-06T09:00:00.000Z' },
    // Delivery tx-6: Andi antar 10 Galon Aqua ke Bu Ani, terima 20 galon kosong
    { id: 'mov-7', movementType: 'dispatch',   productId: 'prod-1', productName: 'Galon Aqua', fromLocationId: 'loc-2', fromLocationName: 'Truk Andi', quantity: 10, containerStatus: 'filled', notes: 'Penjualan tx-6 — Toko Bu Ani', createdByName: 'Andi Kurir', createdAt: '2026-05-10T09:30:00.000Z' },
    { id: 'mov-8', movementType: 'receive',    productId: 'prod-1', productName: 'Galon Aqua', toLocationId: 'loc-2', toLocationName: 'Truk Andi', quantity: 20, containerStatus: 'empty',  notes: 'Kontainer kosong diterima dari Toko Bu Ani (tx-6)', createdByName: 'Andi Kurir', createdAt: '2026-05-10T09:35:00.000Z' },
    // Delivery tx-7: Andi antar 20 Galon Aqua ke Pak Joko, terima 10 galon kosong
    { id: 'mov-9', movementType: 'dispatch',   productId: 'prod-1', productName: 'Galon Aqua', fromLocationId: 'loc-2', fromLocationName: 'Truk Andi', quantity: 20, containerStatus: 'filled', notes: 'Penjualan tx-7 — Warung Pak Joko', createdByName: 'Andi Kurir', createdAt: '2026-05-10T11:00:00.000Z' },
    { id: 'mov-10', movementType: 'receive',   productId: 'prod-1', productName: 'Galon Aqua', toLocationId: 'loc-2', toLocationName: 'Truk Andi', quantity: 10, containerStatus: 'empty',  notes: 'Kontainer kosong diterima dari Warung Pak Joko (tx-7)', createdByName: 'Andi Kurir', createdAt: '2026-05-10T11:05:00.000Z' },
    // Vendor exchange: Budi bawa galon kosong ke supplier, terima galon terisi + bayar biaya
    { id: 'mov-11', movementType: 'vendor_exchange', productId: 'prod-1', productName: 'Galon Aqua',      toLocationId: 'loc-1', toLocationName: 'Gudang Utama', quantity: 50, containerStatus: 'filled', purchaseCost: 450000, notes: 'Tukar galon kosong ke depot', createdByName: 'Budi Santoso', createdAt: '2026-05-10T00:00:00.000Z' },
    { id: 'mov-12', movementType: 'receive',         productId: 'prod-4', productName: 'Gas LPG 3 kg',    toLocationId: 'loc-1', toLocationName: 'Gudang Utama', quantity: 20, containerStatus: 'filled', purchaseCost: 320000, notes: 'Restock LPG 3 kg dari agen', createdByName: 'Budi Santoso', createdAt: '2026-05-10T00:30:00.000Z' },
    { id: 'mov-13', movementType: 'production',      productId: 'prod-3', productName: 'Galon Isi Ulang', fromLocationId: 'loc-1', fromLocationName: 'Gudang Utama', quantity: 15, containerStatus: 'filled', purchaseCost: 45000, notes: '[Produksi] Isi ulang 15 galon', createdByName: 'Budi Santoso', createdAt: '2026-05-10T00:45:00.000Z' },
  ] as StockMovement[],

  transactions: [
    {
      id: 'tx-1', transactionType: 'delivery',
      customerId: 'cust-1', customerName: 'Toko Bu Ani',
      locationId: 'loc-2', locationName: 'Truk Andi',
      items: [{ productId: 'prod-1', productName: 'Galon Aqua', quantity: 3, unitPrice: 4500, subtotal: 13500 }],
      totalAmount: 13500, paidAmount: 13500, status: 'completed',
      staffId: 'user-2', staffName: 'Andi Kurir', createdAt: '2025-04-10T09:00:00.000Z', completedAt: '2025-04-10T10:00:00.000Z',
    },
    {
      id: 'tx-2', transactionType: 'counter',
      customerId: 'cust-2', customerName: 'Warung Pak Joko',
      locationId: 'loc-1', locationName: 'Gudang Utama',
      items: [{ productId: 'prod-4', productName: 'Gas LPG 3 kg', quantity: 2, unitPrice: 20000, subtotal: 40000 }],
      totalAmount: 40000, paidAmount: 20000, status: 'completed',
      staffId: 'user-3', staffName: 'Sari Kasir', createdAt: '2025-04-11T10:00:00.000Z',
    },
    {
      id: 'tx-3', transactionType: 'delivery',
      customerId: 'cust-3', customerName: 'Restoran Sedap',
      locationId: 'loc-3', locationName: 'Truk Rudi',
      items: [
        { productId: 'prod-5', productName: 'Gas LPG 12 kg', quantity: 1, unitPrice: 85000, subtotal: 85000 },
        { productId: 'prod-4', productName: 'Gas LPG 3 kg',  quantity: 2, unitPrice: 20000, subtotal: 40000 },
      ],
      totalAmount: 125000, paidAmount: 0, status: 'completed',
      staffId: 'user-4', staffName: 'Rudi Kurir', createdAt: '2025-04-12T08:00:00.000Z',
    },
    {
      id: 'tx-4', transactionType: 'counter',
      locationId: 'loc-1', locationName: 'Gudang Utama',
      items: [{ productId: 'prod-6', productName: 'Air Isi Ulang 240ml', quantity: 10, unitPrice: 500, subtotal: 5000 }],
      totalAmount: 5000, paidAmount: 5000, status: 'completed',
      staffId: 'user-3', staffName: 'Sari Kasir', createdAt: '2025-04-13T11:00:00.000Z', completedAt: '2025-04-13T11:00:00.000Z',
    },
    {
      id: 'tx-5', transactionType: 'counter',
      customerId: 'cust-1', customerName: 'Toko Bu Ani',
      locationId: 'loc-1', locationName: 'Gudang Utama',
      items: [{ productId: 'prod-4', productName: 'Gas LPG 3 kg', quantity: 5, unitPrice: 20000, subtotal: 100000 }],
      totalAmount: 100000, paidAmount: 100000, status: 'completed',
      staffId: 'user-1', staffName: 'Budi Santoso', createdAt: '2025-04-14T15:00:00.000Z', completedAt: '2025-04-14T15:00:00.000Z',
    },
    {
      // Kasus 1: Andi antar 10 Galon Aqua ke Bu Ani, Bu Ani kembalikan 20 galon kosong
      // Net Bu Ani (prod-1): loan-1(+3) + loan-3(+10) + loan-4(-20) = -7
      // Artinya: kita memegang 7 galon milik Bu Ani di truk, harus dikembalikan terisi
      id: 'tx-6', transactionType: 'delivery',
      customerId: 'cust-1', customerName: 'Toko Bu Ani',
      locationId: 'loc-2', locationName: 'Truk Andi',
      items: [{ productId: 'prod-1', productName: 'Galon Aqua', quantity: 10, unitPrice: 4500, subtotal: 45000 }],
      totalAmount: 45000, paidAmount: 45000, status: 'completed',
      staffId: 'user-2', staffName: 'Andi Kurir', createdAt: '2026-05-10T09:30:00.000Z', completedAt: '2026-05-10T09:30:00.000Z',
    },
    {
      // Kasus 2: Andi antar 20 Galon Aqua ke Pak Joko, Pak Joko kembalikan 10 galon kosong
      // Net Pak Joko (prod-1): loan-5(+20) + loan-6(-10) = +10
      // Artinya: Pak Joko masih memegang 10 galon milik kita yang belum dikembalikan
      id: 'tx-7', transactionType: 'delivery',
      customerId: 'cust-2', customerName: 'Warung Pak Joko',
      locationId: 'loc-2', locationName: 'Truk Andi',
      items: [{ productId: 'prod-1', productName: 'Galon Aqua', quantity: 20, unitPrice: 5000, subtotal: 100000 }],
      totalAmount: 100000, paidAmount: 100000, status: 'completed',
      staffId: 'user-2', staffName: 'Andi Kurir', createdAt: '2026-05-10T11:00:00.000Z', completedAt: '2026-05-10T11:00:00.000Z',
    },
    {
      // Kasir: Restoran Sedap beli 3 Gas LPG 3 kg, bayar sebagian
      id: 'tx-8', transactionType: 'counter',
      customerId: 'cust-3', customerName: 'Restoran Sedap',
      locationId: 'loc-1', locationName: 'Gudang Utama',
      items: [{ productId: 'prod-4', productName: 'Gas LPG 3 kg', quantity: 3, unitPrice: 20000, subtotal: 60000 }],
      totalAmount: 60000, paidAmount: 30000, status: 'completed',
      staffId: 'user-3', staffName: 'Sari Kasir', createdAt: '2026-05-10T01:00:00.000Z', completedAt: '2026-05-10T01:00:00.000Z',
    },
    {
      // Kasir: penjualan tunai anonim (cup air)
      id: 'tx-9', transactionType: 'counter',
      locationId: 'loc-1', locationName: 'Gudang Utama',
      items: [{ productId: 'prod-6', productName: 'Air Isi Ulang 240ml', quantity: 20, unitPrice: 500, subtotal: 10000 }],
      totalAmount: 10000, paidAmount: 10000, status: 'completed',
      staffId: 'user-3', staffName: 'Sari Kasir', createdAt: '2026-05-10T06:00:00.000Z', completedAt: '2026-05-10T06:00:00.000Z',
    },
    {
      // Rudi antar Gas LPG 12 kg ke Toko Bu Ani, belum dibayar (piutang penuh)
      id: 'tx-10', transactionType: 'delivery',
      customerId: 'cust-1', customerName: 'Toko Bu Ani',
      locationId: 'loc-3', locationName: 'Truk Rudi',
      items: [{ productId: 'prod-5', productName: 'Gas LPG 12 kg', quantity: 2, unitPrice: 85000, subtotal: 170000 }],
      totalAmount: 170000, paidAmount: 0, status: 'completed',
      staffId: 'user-4', staffName: 'Rudi Kurir', createdAt: '2026-05-10T08:30:00.000Z', completedAt: '2026-05-10T08:30:00.000Z',
    },
  ] as Transaction[],

  debtPayments: [
    { id: 'debt-1', customerId: 'cust-1', customerName: 'Toko Bu Ani',     amount: 25000,  note: 'Bayar sebagian',          createdByName: 'Sari Kasir',   createdAt: '2025-04-08T10:00:00.000Z' },
    { id: 'debt-2', customerId: 'cust-3', customerName: 'Restoran Sedap',  amount: 100000, note: 'DP cicilan bulan ini',     createdByName: 'Budi Santoso', createdAt: '2025-04-09T14:00:00.000Z' },
    { id: 'debt-3', customerId: 'cust-1', customerName: 'Toko Bu Ani',     amount: 10000,  note: 'Bayar sisa transaksi lama', createdByName: 'Sari Kasir',  createdAt: '2025-04-15T09:00:00.000Z' },
    { id: 'debt-4', customerId: 'cust-1', customerName: 'Toko Bu Ani',     amount: 50000,  note: 'Pelunasan hutang galon',   createdByName: 'Sari Kasir',   createdAt: '2026-05-10T02:30:00.000Z' },
    { id: 'debt-5', customerId: 'cust-2', customerName: 'Warung Pak Joko', amount: 75000,  note: 'Cicilan minggu ini',       createdByName: 'Budi Santoso', createdAt: '2026-05-10T04:00:00.000Z' },
    { id: 'debt-6', customerId: 'cust-3', customerName: 'Restoran Sedap',  amount: 100000, note: undefined,                  createdByName: 'Sari Kasir',   createdAt: '2026-05-10T07:15:00.000Z' },
  ] as DebtPayment[],

  assignments: [
    {
      id: 'asgn-1',
      kurirId: 'user-2', kurirName: 'Andi Kurir',
      customerId: 'cust-1', customerName: 'Toko Bu Ani',
      items: [
        { productId: 'prod-1', productName: 'Galon Aqua',  quantity: 2, unitPrice: 4500 },
        { productId: 'prod-4', productName: 'Gas LPG 3 kg', quantity: 1, unitPrice: 20000 },
      ],
      notes: 'Prioritas pagi — Bu Ani minta sebelum jam 10',
      status: 'pending',
      createdByName: 'Budi Santoso',
      createdAt: '2026-05-11T07:00:00.000Z',
    },
    {
      id: 'asgn-2',
      kurirId: 'user-4', kurirName: 'Rudi Kurir',
      customerId: 'cust-2', customerName: 'Warung Pak Joko',
      items: [
        { productId: 'prod-2', productName: 'Galon Vit', quantity: 3, unitPrice: 4800 },
      ],
      notes: undefined,
      status: 'pending',
      createdByName: 'Sari Kasir',
      createdAt: '2026-05-11T07:30:00.000Z',
    },
  ] as DeliveryAssignment[],

  containerLoans: [
    { id: 'loan-1', customerId: 'cust-1', customerName: 'Toko Bu Ani',    productId: 'prod-1', productName: 'Galon Aqua',    quantity:  3, notes: 'Pinjam galon cadangan',    createdByName: 'Sari Kasir',   createdAt: '2025-04-01T08:00:00.000Z' },
    { id: 'loan-2', customerId: 'cust-3', customerName: 'Restoran Sedap', productId: 'prod-4', productName: 'Gas LPG 3 kg',  quantity:  5, notes: 'Tabung cadangan restoran', createdByName: 'Budi Santoso', createdAt: '2025-04-05T10:00:00.000Z' },
    // tx-6: Andi antar 10 Galon Aqua ke Bu Ani, terima 20 galon kosong
    { id: 'loan-3', customerId: 'cust-1', customerName: 'Toko Bu Ani',    productId: 'prod-1', productName: 'Galon Aqua', quantity: +10, transactionId: 'tx-6', notes: 'Antar 10 galon terisi',              createdByName: 'Andi Kurir', createdAt: '2025-04-20T09:30:00.000Z' },
    { id: 'loan-4', customerId: 'cust-1', customerName: 'Toko Bu Ani',    productId: 'prod-1', productName: 'Galon Aqua', quantity: -20, transactionId: 'tx-6', notes: 'Terima 20 galon kosong dari Bu Ani', createdByName: 'Andi Kurir', createdAt: '2025-04-20T09:35:00.000Z' },
    // tx-7: Andi antar 20 Galon Aqua ke Pak Joko, terima 10 galon kosong
    { id: 'loan-5', customerId: 'cust-2', customerName: 'Warung Pak Joko', productId: 'prod-1', productName: 'Galon Aqua', quantity: +20, transactionId: 'tx-7', notes: 'Antar 20 galon terisi',               createdByName: 'Andi Kurir', createdAt: '2025-04-20T11:00:00.000Z' },
    { id: 'loan-6', customerId: 'cust-2', customerName: 'Warung Pak Joko', productId: 'prod-1', productName: 'Galon Aqua', quantity: -10, transactionId: 'tx-7', notes: 'Terima 10 galon kosong dari Pak Joko', createdByName: 'Andi Kurir', createdAt: '2025-04-20T11:05:00.000Z' },
  ] as ContainerLoan[],

  dashboardStats: {
    todayRevenue: 118500,
    todayTransactions: 5,
    todayPurchaseCost: 1525000,
    todayDebtCollected: 135000,
    lowStockCount: 2,
    totalOutstandingDebt: 195000,
    previousDayRevenue: 430000,
    weeklyChart: [
      { date: '2026-05-03', revenue:  95000, transactionCount: 3,  purchaseCost:  280000 },
      { date: '2026-05-04', revenue: 210000, transactionCount: 8,  purchaseCost:  620000 },
      { date: '2026-05-05', revenue: 175000, transactionCount: 6,  purchaseCost:  510000 },
      { date: '2026-05-06', revenue: 340000, transactionCount: 12, purchaseCost:  980000 },
      { date: '2026-05-07', revenue: 280000, transactionCount: 10, purchaseCost:  750000 },
      { date: '2026-05-08', revenue: 430000, transactionCount: 15, purchaseCost: 1525000 },
      { date: '2026-05-09', revenue: 118500, transactionCount: 5,  purchaseCost: 1525000 },
    ],
    recentTransactions: [
      { id: 'tx-7', createdAt: '2025-04-20T11:00:00.000Z', customerName: 'Warung Pak Joko', createdByName: 'Andi Kurir',   type: 'delivery', totalAmount: 100000, paidAmount: 100000, status: 'completed' },
      { id: 'tx-6', createdAt: '2025-04-20T09:30:00.000Z', customerName: 'Toko Bu Ani',     createdByName: 'Andi Kurir',   type: 'delivery', totalAmount:  45000, paidAmount:  45000, status: 'completed' },
      { id: 'tx-5', createdAt: '2025-04-14T15:00:00.000Z', customerName: 'Toko Bu Ani',     createdByName: 'Budi Santoso', type: 'counter',  totalAmount: 100000, paidAmount: 100000, status: 'completed' },
      { id: 'tx-4', createdAt: '2025-04-13T11:00:00.000Z', customerName: undefined,          createdByName: 'Sari Kasir',   type: 'counter',  totalAmount:   5000, paidAmount:   5000, status: 'completed' },
      { id: 'tx-3', createdAt: '2025-04-12T08:00:00.000Z', customerName: 'Restoran Sedap',  createdByName: 'Rudi Kurir',   type: 'delivery', totalAmount: 125000, paidAmount:      0, status: 'completed' },
      { id: 'tx-2', createdAt: '2025-04-11T10:00:00.000Z', customerName: 'Warung Pak Joko', createdByName: 'Sari Kasir',   type: 'counter',  totalAmount:  40000, paidAmount:  20000, status: 'completed' },
      { id: 'tx-1', createdAt: '2025-04-10T09:00:00.000Z', customerName: 'Toko Bu Ani',     createdByName: 'Andi Kurir',   type: 'delivery', totalAmount:  13500, paidAmount:  13500, status: 'completed' },
    ],
    warehouseStock: [
      { productId: 'prod-1', productName: 'Galon Aqua',          productUnit: 'galon',       productCategory: 'refillable', locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: 50,   quantityEmpty: 10,   quantityTotal: null },
      { productId: 'prod-2', productName: 'Galon Vit',           productUnit: 'galon',       productCategory: 'refillable', locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: 30,   quantityEmpty: 15,   quantityTotal: null },
      { productId: 'prod-3', productName: 'Galon Isi Ulang',     productUnit: 'galon',       productCategory: 'refillable', locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: 4,    quantityEmpty: 8,    quantityTotal: null },
      { productId: 'prod-4', productName: 'Gas LPG 3 kg',        productUnit: 'tabung 3kg',  productCategory: 'refillable', locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: 30,   quantityEmpty: 5,    quantityTotal: null },
      { productId: 'prod-5', productName: 'Gas LPG 12 kg',       productUnit: 'tabung 12kg', productCategory: 'refillable', locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: 3,    quantityEmpty: 2,    quantityTotal: null },
      { productId: 'prod-6', productName: 'Air Isi Ulang 240ml', productUnit: 'cup',         productCategory: 'simple',     locationId: 'loc-1', locationName: 'Gudang Utama', quantityFilled: null, quantityEmpty: null, quantityTotal: 200  },
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
