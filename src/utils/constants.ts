export const ROLES = {
  OWNER: 'owner',
  KURIR: 'kurir',
  KASIR: 'kasir',
} as const;

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  kurir: 'Kurir',
  kasir: 'Kasir',
};

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  warehouse: 'Gudang',
  vehicle: 'Kendaraan',
};

export const PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  simple: 'Sederhana',
  refillable: 'Refillable',
};

export const PRODUCTION_TYPE_LABELS: Record<string, string> = {
  purchased: 'Beli',
  self_produced: 'Produksi Sendiri',
};

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  air: 'Air',
  gas: 'Gas',
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  delivery: 'Pengiriman',
  counter: 'Kasir',
};

export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  receive: 'Terima',
  transfer: 'Transfer',
  dispatch: 'Penjualan',
  defect: 'Rusak/Defek',
  production: 'Produksi',
  vendor_exchange: 'Tukar Agent',
};

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu',
  fulfilled: 'Terpenuhi',
  cancelled: 'Dibatalkan',
};

export const UNIT_OPTIONS = [
  { value: 'galon', label: 'Galon' },
  { value: 'tabung 3kg', label: 'Tabung 3 kg' },
  { value: 'tabung 12kg', label: 'Tabung 12 kg' },
  { value: 'karton', label: 'Karton' },
  { value: 'dus', label: 'Dus' },
  { value: 'cup', label: 'Cup' },
  { value: 'botol', label: 'Botol' },
  { value: 'pcs', label: 'Pcs' },
];

export const CONTAINER_STATUS_LABELS: Record<string, string> = {
  filled: 'Terisi',
  empty: 'Kosong',
};

export const POLLING_INTERVAL = 8000; // 8 seconds

export const DEFAULT_PAGE_SIZE = 20;
