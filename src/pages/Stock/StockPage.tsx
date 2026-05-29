import { useState, useEffect, useCallback } from 'react';
import { stockService } from '../../services/stockService';
import { productService } from '../../services/productService';
import { locationService } from '../../services/locationService';
import { containerLoanService } from '../../services/containerLoanService';
import { customerService } from '../../services/customerService';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, Input, Select, EmptyState, Spinner, ConfirmDialog } from '../../components/common';
import { MOVEMENT_TYPE_LABELS } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/apiError';
import type { StockLevel, StockMovement, Product, Location, ContainerLoan, Customer } from '../../types';
import styles from './StockPage.module.scss';

type Tab = 'levels' | 'movements' | 'receive' | 'vendor' | 'transfer' | 'defect' | 'production' | 'adjustment' | 'container_loans';
interface ReceiveItem { _key: string; product_id: string; quantity: string; container_status: string; purchase_cost: string; }
interface BulkLoanItem { _key: string; product_id: string; quantity: string; container_status: string; }
interface TransferItem { _key: string; product_id: string; quantity: string; container_status: string; }
interface VendorItem { _key: string; product_id: string; empty_quantity: string; filled_quantity: string; purchase_cost: string; }
interface AdjustItem { _key: string; product_id: string; quantity: string; direction: '+' | '-'; container_status: string; }
function newKey() { return Math.random().toString(36).slice(2); }
function getTodayWIB(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

export function StockPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const isKasir = user?.role === 'kasir';
  const isKurir = user?.role === 'kurir';
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>('levels');
  const [levels, setLevels] = useState<StockLevel[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms — Receive (multi-item cart)
  const [receiveShared, setReceiveShared] = useState({ to_location_id: '', notes: '' });
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([{ _key: newKey(), product_id: '', quantity: '', container_status: '', purchase_cost: '' }]);
  // Forms — Transfer (multi-item cart)
  const [transferShared, setTransferShared] = useState({ from_location_id: '', to_location_id: '', notes: '' });
  const [transferItems, setTransferItems] = useState<TransferItem[]>([{ _key: newKey(), product_id: '', quantity: '', container_status: '' }]);
  const [defectForm, setDefectForm] = useState({ product_id: '', from_location_id: '', quantity: '', container_status: '', notes: '' });
  // Forms — Vendor Exchange (multi-item cart)
  const [vendorShared, setVendorShared] = useState({ location_id: '', notes: '' });
  const [vendorItems, setVendorItems] = useState<VendorItem[]>([{ _key: newKey(), product_id: '', empty_quantity: '', filled_quantity: '', purchase_cost: '' }]);
  const [productionForm, setProductionForm] = useState({ product_id: '', location_id: '', quantity: '', production_cost: '', notes: '' });
  const [containerLoans, setContainerLoans] = useState<ContainerLoan[]>([]);
  const [containerLoansLoading, setContainerLoansLoading] = useState(false);
  const [movementsDate, setMovementsDate] = useState<string>(getTodayWIB());
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // ── Reversal confirm ──────────────────────────────────────────────────────────
  const [reverseTarget, setReverseTarget] = useState<StockMovement | null>(null);

  // ── Adjustment form ───────────────────────────────────────────────────────────
  const [adjustShared, setAdjustShared] = useState({ location_id: '', note: '' });
  const [adjustItems, setAdjustItems] = useState<AdjustItem[]>([{ _key: newKey(), product_id: '', quantity: '', direction: '+' as '+' | '-', container_status: '' }]);

  // ── Bulk manual container loan form ──────────────────────────────────────────
  const [bulkLoanOpen, setBulkLoanOpen] = useState(false);
  const [bulkLoanDirection, setBulkLoanDirection] = useState<'pinjam' | 'terima'>('pinjam');
  const [bulkLoanCustomer, setBulkLoanCustomer] = useState('');
  const [bulkLoanLocation, setBulkLoanLocation] = useState('');
  const [bulkLoanNote, setBulkLoanNote] = useState('');
  const [bulkLoanItems, setBulkLoanItems] = useState<BulkLoanItem[]>([{ _key: newKey(), product_id: '', quantity: '', container_status: '' }]);

  // ── Transfer negative-stock warning ──────────────────────────────────────────
  const [transferWarnings, setTransferWarnings] = useState<string[]>([]);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  // ── Bulk loan negative-stock warning ─────────────────────────────────────────
  const [bulkLoanWarnings, setBulkLoanWarnings] = useState<string[]>([]);
  const [bulkLoanConfirmOpen, setBulkLoanConfirmOpen] = useState(false);
  // ── Transfer auto-populate from vehicle ──────────────────────────────────────
  const [transferAutoPopulated, setTransferAutoPopulated] = useState(false);

  const load = useCallback(async () => {
    const [lvls, prods, locs, custs] = await Promise.all([
      stockService.getLevels().catch((err) => { showToast(getErrorMessage(err, 'Gagal memuat level stok.'), 'error'); return []; }),
      productService.list().catch((err) => { showToast(getErrorMessage(err, 'Gagal memuat produk.'), 'error'); return []; }),
      locationService.list().catch((err) => { showToast(getErrorMessage(err, 'Gagal memuat lokasi.'), 'error'); return []; }),
      customerService.list().catch(() => []),
    ]);
    setLevels(lvls as StockLevel[]);
    setProducts((prods as Product[]).filter((p) => p.isActive));
    setLocations((locs as Location[]).filter((l) => l.isActive));
    setCustomers((custs as Customer[]).filter((c) => c.isActive));
    setLoading(false);
  }, [showToast]);

  async function loadMovements(date: string) {
    setMovementsLoading(true);
    try {
      const mvts = await stockService.getMovements(date);
      setMovements(mvts as StockMovement[]);
    } finally {
      setMovementsLoading(false);
    }
  }

  useEffect(() => { load(); }, [load]);

  const productOptions = products.map((p) => ({ value: p.id, label: `${p.name} (${p.unit})` }));
  const selfProducedOptions = products
    .filter((p) => p.category === 'refillable' && p.productionType === 'selfproduced')
    .map((p) => ({ value: p.id, label: `${p.name} (${p.unit})` }));
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));
  const containerOptions = [{ value: 'filled', label: 'Terisi' }, { value: 'empty', label: 'Kosong' }];

  function resetFeedback() { /* noop — feedback now via toast */ }

  async function handleReceive() {
    setSaving(true); resetFeedback();
    try {
      await stockService.receiveBulk({
        toLocationId: receiveShared.to_location_id,
        note: receiveShared.notes || undefined,
        items: receiveItems.map((item) => ({
          productId: item.product_id,
          quantity: parseInt(item.quantity),
          containerStatus: item.container_status || undefined,
          purchaseCost: item.purchase_cost ? parseFloat(item.purchase_cost) : undefined,
        })),
      });
      setReceiveShared({ to_location_id: '', notes: '' });
      setReceiveItems([{ _key: newKey(), product_id: '', quantity: '', container_status: '', purchase_cost: '' }]);
      showToast('Stok berhasil diterima.'); load();
    } catch (err) { showToast(getErrorMessage(err, 'Gagal menyimpan. Periksa kembali data.'), 'error'); }
    finally { setSaving(false); }
  }

  function computeTransferWarnings(): string[] {
    if (!transferShared.from_location_id) return [];
    const warnings: string[] = [];
    for (const item of transferItems) {
      if (!item.product_id || !item.quantity) continue;
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) continue;
      const product = products.find((p) => p.id === item.product_id);
      const level = levels.find(
        (l) => l.productId === item.product_id && l.locationId === transferShared.from_location_id
      );
      let available: number;
      if (!level) {
        available = 0;
      } else if (product?.category === 'simple') {
        available = level.quantityTotal ?? 0;
      } else {
        if (item.container_status === 'filled') {
          available = level.quantityFilled ?? 0;
        } else if (item.container_status === 'empty') {
          available = level.quantityEmpty ?? 0;
        } else {
          continue; // no container_status selected — skip, server will validate
        }
      }
      if (available - qty < 0) {
        const productName = product?.name ?? item.product_id;
        warnings.push(`${productName}: tersedia ${available}, diminta ${qty}`);
      }
    }
    return warnings;
  }

  function computeBulkLoanWarnings(): string[] {
    if (bulkLoanDirection !== 'pinjam' || !bulkLoanLocation) return [];
    const warnings: string[] = [];
    for (const item of bulkLoanItems) {
      if (!item.product_id || !item.quantity || !item.container_status) continue;
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) continue;
      const product = products.find((p) => p.id === item.product_id);
      const level = levels.find(
        (l) => l.productId === item.product_id && l.locationId === bulkLoanLocation
      );
      let available: number;
      if (!level) {
        available = 0;
      } else if (item.container_status === 'filled') {
        available = level.quantityFilled ?? 0;
      } else if (item.container_status === 'empty') {
        available = level.quantityEmpty ?? 0;
      } else {
        continue;
      }
      if (available - qty < 0) {
        const productName = product?.name ?? item.product_id;
        warnings.push(`${productName} (${item.container_status === 'filled' ? 'Terisi' : 'Kosong'}): tersedia ${available}, diminta ${qty}`);
      }
    }
    return warnings;
  }

  async function doTransfer() {
    setSaving(true); resetFeedback();
    try {
      await stockService.transferBulk({
        fromLocationId: transferShared.from_location_id,
        toLocationId: transferShared.to_location_id,
        note: transferShared.notes || undefined,
        items: transferItems.map((item) => ({
          productId: item.product_id,
          quantity: parseInt(item.quantity),
          containerStatus: item.container_status || undefined,
        })),
      });
      setTransferShared({ from_location_id: '', to_location_id: '', notes: '' });
      setTransferItems([{ _key: newKey(), product_id: '', quantity: '', container_status: '' }]);
      setTransferAutoPopulated(false);
      showToast('Transfer stok berhasil.'); load();
    } catch (err) { showToast(getErrorMessage(err, 'Gagal menyimpan. Periksa kembali data.'), 'error'); }
    finally { setSaving(false); }
  }

  async function handleTransfer() {
    resetFeedback();
    const warnings = computeTransferWarnings();
    if (warnings.length > 0) {
      setTransferWarnings(warnings);
      setTransferConfirmOpen(true);
      return;
    }
    await doTransfer();
  }

  // -- Receive item helpers --
  function updateReceiveItem(key: string, patch: Partial<ReceiveItem>) {
    setReceiveItems((prev) => prev.map((item) => {
      if (item._key !== key) return item;
      const updated = { ...item, ...patch };
      if ('product_id' in patch) {
        const prod = products.find((p) => p.id === patch.product_id);
        if (prod?.category === 'simple') updated.container_status = 'na';
        else if (updated.container_status === 'na') updated.container_status = '';
      }
      return updated;
    }));
  }
  function removeReceiveItem(key: string) {
    setReceiveItems((prev) => prev.length > 1 ? prev.filter((item) => item._key !== key) : prev);
  }
  function addReceiveItem() {
    setReceiveItems((prev) => [...prev, { _key: newKey(), product_id: '', quantity: '', container_status: '', purchase_cost: '' }]);
  }

  // ── Transfer auto-populate helpers ─────────────────────────────────────────
  function autoPopulateFromVehicle(locationId: string) {
    const vehicleLevels = levels.filter((l) => l.locationId === locationId);
    const items: TransferItem[] = [];
    for (const level of vehicleLevels) {
      if (level.productCategory === 'simple' && (level.quantityTotal ?? 0) > 0) {
        items.push({ _key: newKey(), product_id: level.productId, quantity: String(level.quantityTotal), container_status: 'na' });
      } else if (level.productCategory === 'refillable') {
        if ((level.quantityFilled ?? 0) > 0) {
          items.push({ _key: newKey(), product_id: level.productId, quantity: String(level.quantityFilled), container_status: 'filled' });
        }
        if ((level.quantityEmpty ?? 0) > 0) {
          items.push({ _key: newKey(), product_id: level.productId, quantity: String(level.quantityEmpty), container_status: 'empty' });
        }
      }
    }
    if (items.length > 0) {
      setTransferItems(items);
      setTransferAutoPopulated(true);
    } else {
      setTransferItems([{ _key: newKey(), product_id: '', quantity: '', container_status: '' }]);
      setTransferAutoPopulated(false);
    }
  }

  function handleFromLocationChange(locationId: string) {
    setTransferShared((p) => ({ ...p, from_location_id: locationId }));
    const loc = locations.find((l) => l.id === locationId);
    if (loc?.type === 'vehicle') {
      autoPopulateFromVehicle(locationId);
    } else {
      setTransferItems([{ _key: newKey(), product_id: '', quantity: '', container_status: '' }]);
      setTransferAutoPopulated(false);
    }
  }

  // -- Transfer item helpers --
  function updateTransferItem(key: string, patch: Partial<TransferItem>) {
    setTransferItems((prev) => prev.map((item) => {
      if (item._key !== key) return item;
      const updated = { ...item, ...patch };
      if ('product_id' in patch) {
        const prod = products.find((p) => p.id === patch.product_id);
        if (prod?.category === 'simple') updated.container_status = 'na';
        else if (updated.container_status === 'na') updated.container_status = '';
      }
      return updated;
    }));
  }
  function removeTransferItem(key: string) {
    setTransferItems((prev) => prev.length > 1 ? prev.filter((item) => item._key !== key) : prev);
  }
  function addTransferItem() {
    setTransferItems((prev) => [...prev, { _key: newKey(), product_id: '', quantity: '', container_status: '' }]);
  }

  async function handleDefect() {
    setSaving(true); resetFeedback();
    try {
      await stockService.defect({
        productId: defectForm.product_id, fromLocationId: defectForm.from_location_id,
        quantity: parseInt(defectForm.quantity), containerStatus: defectForm.container_status || undefined,
        note: defectForm.notes || undefined,
      });
      setDefectForm({ product_id: '', from_location_id: '', quantity: '', container_status: '', notes: '' });
      showToast('Defek berhasil dicatat.'); load();
    } catch (err) { showToast(getErrorMessage(err, 'Gagal menyimpan. Periksa kembali data.'), 'error'); }
    finally { setSaving(false); }
  }

  async function handleVendorExchange() {
    setSaving(true); resetFeedback();
    try {
      await stockService.vendorExchangeBulk({
        locationId: vendorShared.location_id,
        note: vendorShared.notes || undefined,
        items: vendorItems.map((item) => ({
          productId: item.product_id,
          emptyQuantity: parseInt(item.empty_quantity) || 0,
          filledQuantity: parseInt(item.filled_quantity) || 0,
          purchaseCost: parseFloat(item.purchase_cost) || 0,
        })),
      });
      setVendorShared({ location_id: '', notes: '' });
      setVendorItems([{ _key: newKey(), product_id: '', empty_quantity: '', filled_quantity: '', purchase_cost: '' }]);
      showToast('Tukar agent berhasil dicatat.'); load();
    } catch (err) { showToast(getErrorMessage(err, 'Gagal menyimpan. Periksa kembali data.'), 'error'); }
    finally { setSaving(false); }
  }

  // -- Vendor item helpers --
  function updateVendorItem(key: string, patch: Partial<VendorItem>) {
    setVendorItems((prev) => prev.map((item) => item._key === key ? { ...item, ...patch } : item));
  }
  function removeVendorItem(key: string) {
    setVendorItems((prev) => prev.length > 1 ? prev.filter((item) => item._key !== key) : prev);
  }
  function addVendorItem() {
    setVendorItems((prev) => [...prev, { _key: newKey(), product_id: '', empty_quantity: '', filled_quantity: '', purchase_cost: '' }]);
  }

  // ── Adjust item helpers ───────────────────────────────────────────────────────
  function updateAdjustItem(key: string, patch: Partial<AdjustItem>) {
    setAdjustItems((prev) => prev.map((item) => {
      if (item._key !== key) return item;
      const updated = { ...item, ...patch };
      if ('product_id' in patch) {
        const prod = products.find((p) => p.id === patch.product_id);
        if (prod?.category === 'simple') updated.container_status = 'na';
        else if (updated.container_status === 'na') updated.container_status = '';
      }
      return updated;
    }));
  }
  function removeAdjustItem(key: string) {
    setAdjustItems((prev) => prev.length > 1 ? prev.filter((item) => item._key !== key) : prev);
  }
  function addAdjustItem() {
    setAdjustItems((prev) => [...prev, { _key: newKey(), product_id: '', quantity: '', direction: '+', container_status: '' }]);
  }

  async function handleReverseMovement(movement: StockMovement) {
    setSaving(true);
    try {
      await stockService.reverseMovement(movement.id);
      showToast('Pergerakan stok berhasil dibatalkan.');
      loadMovements(movementsDate);
      load();
    } catch (err) { showToast(getErrorMessage(err, 'Gagal membatalkan pergerakan.'), 'error'); }
    finally { setSaving(false); setReverseTarget(null); }
  }

  async function handleAdjust() {
    setSaving(true);
    try {
      if (!adjustShared.location_id || !adjustShared.note.trim()) {
        showToast('Lokasi dan catatan wajib diisi.', 'error'); return;
      }
      const validItems = adjustItems.filter((item) => item.product_id && parseInt(item.quantity) >= 1);
      if (validItems.length === 0) {
        showToast('Tambahkan minimal satu produk dengan jumlah valid.', 'error'); return;
      }
      await stockService.adjustBulk({
        locationId: adjustShared.location_id,
        note: adjustShared.note.trim(),
        items: validItems.map((item) => ({
          productId: item.product_id,
          adjustmentQuantity: item.direction === '+' ? parseInt(item.quantity) : -parseInt(item.quantity),
          containerStatus: item.container_status || undefined,
        })),
      });
      setAdjustShared({ location_id: '', note: '' });
      setAdjustItems([{ _key: newKey(), product_id: '', quantity: '', direction: '+', container_status: '' }]);
      showToast('Penyesuaian stok berhasil dicatat.'); load();
    } catch (err) { showToast(getErrorMessage(err, 'Gagal menyimpan penyesuaian.'), 'error'); }
    finally { setSaving(false); }
  }

  async function doBulkLoanSubmit() {
    setSaving(true);
    try {
      const sign = bulkLoanDirection === 'pinjam' ? 1 : -1;
      const validItems = bulkLoanItems
        .map((item) => ({
          productId: item.product_id,
          quantity: sign * parseInt(item.quantity),
          containerStatus: item.container_status,
        }))
        .filter((item) => item.productId && item.quantity !== 0 && !isNaN(item.quantity) && item.containerStatus);
      await containerLoanService.createBulk({
        customerId: bulkLoanCustomer,
        locationId: bulkLoanLocation,
        note: bulkLoanNote || undefined,
        items: validItems,
      });
      setBulkLoanOpen(false);
      setBulkLoanCustomer(''); setBulkLoanLocation(''); setBulkLoanNote('');
      setBulkLoanItems([{ _key: newKey(), product_id: '', quantity: '', container_status: '' }]);
      setBulkLoanDirection('pinjam');
      showToast('Pinjaman kontainer berhasil dicatat.');
      loadContainerLoans();
      load();
    } catch (err) { showToast(getErrorMessage(err, 'Gagal mencatat pinjaman.'), 'error'); }
    finally { setSaving(false); }
  }

  async function handleBulkLoanSubmit() {
    if (!bulkLoanCustomer) { showToast('Pilih pelanggan terlebih dahulu.', 'error'); return; }
    if (!bulkLoanLocation) { showToast('Pilih lokasi terlebih dahulu.', 'error'); return; }
    const sign = bulkLoanDirection === 'pinjam' ? 1 : -1;
    const validItems = bulkLoanItems
      .map((item) => ({
        productId: item.product_id,
        quantity: sign * parseInt(item.quantity),
        containerStatus: item.container_status,
      }))
      .filter((item) => item.productId && item.quantity !== 0 && !isNaN(item.quantity) && item.containerStatus);
    if (validItems.length === 0) { showToast('Tambahkan minimal satu produk dengan status kontainer.', 'error'); return; }
    const warnings = computeBulkLoanWarnings();
    if (warnings.length > 0) {
      setBulkLoanWarnings(warnings);
      setBulkLoanConfirmOpen(true);
      return;
    }
    await doBulkLoanSubmit();
  }

  async function handleProduction() {
    setSaving(true); resetFeedback();
    try {
      await stockService.production({
        productId: productionForm.product_id, locationId: productionForm.location_id,
        quantity: parseInt(productionForm.quantity),
        productionCost: productionForm.production_cost ? parseFloat(productionForm.production_cost) : undefined,
        note: productionForm.notes || undefined,
      });
      setProductionForm({ product_id: '', location_id: '', quantity: '', production_cost: '', notes: '' });
      showToast('Produksi berhasil dicatat.'); load();
    } catch (err) { showToast(getErrorMessage(err, 'Gagal menyimpan. Periksa kembali data.'), 'error'); }
    finally { setSaving(false); }
  }

  // --- Tab config -------------------------------------------------------------
  const tabs: { key: Tab; label: string }[] = [
    { key: 'levels',          label: 'Level Stok' },
    ...(isOwner                ? [{ key: 'container_loans' as Tab, label: 'Kontainer' }] : []),
    { key: 'movements' as Tab, label: 'Riwayat' },
    ...(isOwner                ? [{ key: 'receive'         as Tab, label: 'Terima Stok' }] : []),
    ...(isOwner                ? [{ key: 'vendor'          as Tab, label: 'Tukar Agent' }] : []),
    ...(isOwner || isKasir     ? [{ key: 'production'      as Tab, label: 'Produksi' }] : []),
    ...(isOwner || isKasir     ? [{ key: 'transfer'        as Tab, label: 'Transfer' }] : []),
    ...(isOwner                ? [{ key: 'defect'          as Tab, label: 'Defek/Rusak' }] : []),
    ...(isOwner                ? [{ key: 'adjustment'      as Tab, label: 'Penyesuaian' }] : []),
  ];
  void isKurir; // used via role-based tab logic above

  async function loadContainerLoans() {
    setContainerLoansLoading(true);
    try {
      const loans = await containerLoanService.list();
      setContainerLoans(loans);
    } finally {
      setContainerLoansLoading(false);
    }
  }

  // --- Levels helpers ----------------------------------------------------------
  /** Group levels by location, and within each location aggregate empty counts by unit. */
  type LocationGroup = { locationId: string; locationName: string; items: StockLevel[] };
  function groupByLocation(data: StockLevel[]): LocationGroup[] {
    const map = new Map<string, LocationGroup>();
    for (const l of data) {
      if (!map.has(l.locationId)) map.set(l.locationId, { locationId: l.locationId, locationName: l.locationName, items: [] });
      map.get(l.locationId)!.items.push(l);
    }
    return Array.from(map.values());
  }

  /** Sum empty quantities per unit across all refillable products in a location group. */
  function emptyPoolByUnit(items: StockLevel[]): Record<string, number> {
    const pool: Record<string, number> = {};
    for (const item of items) {
      if (item.productCategory === 'refillable' && (item.quantityEmpty ?? 0) > 0) {
        pool[item.productUnit] = (pool[item.productUnit] ?? 0) + (item.quantityEmpty ?? 0);
      }
    }
    return pool;
  }

  const locationGroups = groupByLocation(levels);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Stok</h1>
          <button className={styles.refreshBtn} onClick={load}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
          </button>
        </div>

        <div className={styles.tabBar}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={[styles.tabBtn, tab === t.key ? styles.tabActive : ''].join(' ')}
              onClick={() => {
              setTab(t.key);
              resetFeedback();
              if (t.key === 'container_loans') loadContainerLoans();
              if (t.key === 'movements') loadMovements(movementsDate);
            }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {/* -- Level Stok -- */}
        {!loading && tab === 'levels' && (
          <>
            {levels.length === 0 ? (
              <EmptyState message="Belum ada data stok." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {locationGroups.map((group) => {
                  const emptyPool = emptyPoolByUnit(group.items);
                  return (
                    <div key={group.locationId}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-whisper-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        {group.locationName}
                      </div>
                      <div className={styles.cardList}>
                        {group.items.map((l) => {
                          const isLow = l.productCategory === 'refillable'
                            ? (l.quantityFilled ?? 0) <= 0
                            : (l.quantityTotal ?? 0) <= 0;
                          return (
                            <div key={l.productId} className={styles.card}>
                              <div className={styles.cardTop}>
                                <div className={styles.cardInfo}>
                                  <span className={styles.cardName}>{l.productName}</span>
                                  <span className={styles.cardSub}>{l.productUnit}</span>
                                </div>
                                <div className={styles.cardBadges}>
                                  {isLow && <Badge variant="kasir">Stok Habis</Badge>}
                                  {l.productCategory === 'refillable' ? (
                                    <div style={{ textAlign: 'right', fontSize: 13, lineHeight: 1.6 }}>
                                      <div><span style={{ color: 'var(--color-whisper-gray)' }}>Terisi:</span> <strong style={{ color: 'var(--color-deep-space-violet)' }}>{l.quantityFilled ?? 0}</strong></div>
                                      <div><span style={{ color: 'var(--color-whisper-gray)' }}>Kosong:</span> <strong style={{ color: 'var(--color-slate-text)' }}>{l.quantityEmpty ?? 0}</strong></div>
                                    </div>
                                  ) : (
                                    <span className={styles.cardQty}>{l.quantityTotal ?? 0}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* Empty pool summary rows */}
                        {Object.entries(emptyPool).map(([unit, total]) => (
                          <div key={`pool-${unit}`} className={styles.card} style={{ background: 'var(--color-cloud-gray)', borderStyle: 'dashed' }}>
                            <div className={styles.cardTop}>
                              <div className={styles.cardInfo}>
                                <span className={styles.cardName} style={{ fontStyle: 'italic', fontSize: 14 }}>
                                  Pool Kosong — {unit}
                                </span>
                                <span className={styles.cardSub}>Gabungan semua produk</span>
                              </div>
                              <span className={styles.cardQty}>{total}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* -- Riwayat -- */}
        {!loading && tab === 'movements' && (
          <>
            <div className={styles.dateFilterRow}>
              <input
                type="date"
                className={styles.dateInput}
                value={movementsDate}
                max={getTodayWIB()}
                onChange={(e) => { if (e.target.value) { setMovementsDate(e.target.value); loadMovements(e.target.value); } }}
              />
              {movementsDate !== getTodayWIB() && (
                <button className={styles.todayBtn} onClick={() => { setMovementsDate(getTodayWIB()); loadMovements(getTodayWIB()); }}>
                  Hari Ini
                </button>
              )}
            </div>
            {movementsLoading ? (
              <div className={styles.loadingWrap}><Spinner /></div>
            ) : movements.length === 0 ? <EmptyState message="Belum ada riwayat pergerakan stok." /> : (
              <div className={styles.cardList}>
                {movements.map((m) => (
                  <div key={m.id} className={[styles.card, m.isReversed ? styles.cardReversed : ''].join(' ')}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardInfo}>
                        <span className={styles.cardName} style={m.isReversed ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}>{m.productName}</span>
                        <span className={styles.cardRoute}>
                          {m.fromLocationName ?? '—'} → {m.movementType === 'dispatch' && m.customerName ? m.customerName : (m.toLocationName ?? '—')}
                        </span>
                        {m.note && (
                          <span className={styles.cardNote}>{m.note}</span>
                        )}
                      </div>
                      <div className={styles.cardBadges}>
                        {m.isReversed && <Badge variant="cancelled">Dibatalkan</Badge>}
                        {m.isReversal && <Badge variant="kasir">Koreksi</Badge>}
                        <Badge variant="movement">{MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}</Badge>
                        {(m.containerStatus === 'filled' || m.containerStatus === 'empty') && (
                          <Badge variant={m.containerStatus}>{m.containerStatus === 'filled' ? 'Terisi' : 'Kosong'}</Badge>
                        )}
                        <span className={styles.cardQty}>{m.quantity}</span>
                      </div>
                    </div>
                    <div className={styles.cardBottom}>
                      <span className={styles.cardCost}>
                        {m.purchaseCost && !(m.movementType === 'vendor_exchange' && !isOwner)
                          ? formatCurrency(m.purchaseCost)
                          : '—'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isOwner && !m.isReversed && !m.isReversal && m.movementType !== 'dispatch' && (
                          <button
                            className={styles.cancelMvtBtn}
                            onClick={() => setReverseTarget(m)}
                            disabled={saving}
                          >
                            Batalkan
                          </button>
                        )}
                        <span className={styles.cardDate}>{formatDate(m.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* -- Terima Stok (owner only) -- */}
        {!loading && tab === 'receive' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Terima Stok Baru</h2>
            <p className={styles.formSubtitle}>Stok baru dari luar sistem (pembelian, stok awal). Tidak memotong kontainer kosong. Bisa tambah beberapa produk sekaligus.</p>
            <div className={styles.form}>
              <Select label="Lokasi Tujuan" value={receiveShared.to_location_id} onChange={(e) => setReceiveShared(p => ({ ...p, to_location_id: e.target.value }))} options={locationOptions} placeholder="Pilih lokasi..." required />
              <div className={styles.itemList}>
                {receiveItems.map((item) => (
                  <div key={item._key} className={styles.itemRow}>
                    <div className={styles.itemRowHeader}>
                      <Select label="Produk" value={item.product_id} onChange={(e) => updateReceiveItem(item._key, { product_id: e.target.value })} options={productOptions} placeholder="Pilih produk..." required />
                      <button className={styles.removeItemBtn} onClick={() => removeReceiveItem(item._key)} disabled={receiveItems.length === 1} aria-label="Hapus item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className={styles.itemRowControls2}>
                      {products.find((p) => p.id === item.product_id)?.category !== 'simple' && (
                        <Select label="Status Kontainer" value={item.container_status} onChange={(e) => updateReceiveItem(item._key, { container_status: e.target.value })} options={containerOptions} placeholder="— Pilih —" />
                      )}
                      <Input label="Jumlah" type="number" min="1" value={item.quantity} onChange={(e) => updateReceiveItem(item._key, { quantity: e.target.value })} required />
                    </div>
                    <Input label="Biaya Pembelian (Rp, opsional)" currency min="0" value={item.purchase_cost} onChange={(e) => updateReceiveItem(item._key, { purchase_cost: e.target.value })} />
                  </div>
                ))}
              </div>
              <button className={styles.addItemBtn} onClick={addReceiveItem} type="button">+ Tambah Produk</button>
              <Input label="Catatan (opsional)" value={receiveShared.notes} onChange={(e) => setReceiveShared(p => ({ ...p, notes: e.target.value }))} />
              <Button onClick={handleReceive} loading={saving} fullWidth>Terima Semua Stok</Button>
            </div>
          </div>
        )}

        {/* -- Transfer (owner + kasir) -- */}
        {!loading && tab === 'transfer' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Transfer Stok (Muat / Kembali)</h2>
            <p className={styles.formSubtitle}>Pindahkan stok antar lokasi. Gunakan untuk muat truk (gudang → kendaraan) atau barang kembali (kendaraan → gudang). Bisa tambah beberapa produk sekaligus.</p>
            <div className={styles.form}>
              <Select label="Dari Lokasi" value={transferShared.from_location_id} onChange={(e) => handleFromLocationChange(e.target.value)} options={locationOptions} placeholder="Pilih asal..." required />
              {transferAutoPopulated && (
                <p className={styles.autoPopulateNote}>
                  Stok kendaraan dimuat otomatis. Sesuaikan jumlah jika perlu.
                </p>
              )}
              <Select label="Ke Lokasi" value={transferShared.to_location_id} onChange={(e) => setTransferShared(p => ({ ...p, to_location_id: e.target.value }))} options={locationOptions} placeholder="Pilih tujuan..." required />
              <div className={styles.itemList}>
                {transferItems.map((item) => (
                  <div key={item._key} className={styles.itemRow}>
                    <div className={styles.itemRowHeader}>
                      <Select label="Produk" value={item.product_id} onChange={(e) => updateTransferItem(item._key, { product_id: e.target.value })} options={productOptions} placeholder="Pilih produk..." required />
                      <button className={styles.removeItemBtn} onClick={() => removeTransferItem(item._key)} disabled={transferItems.length === 1} aria-label="Hapus item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className={styles.itemRowControls2}>
                      {products.find((p) => p.id === item.product_id)?.category !== 'simple' && (
                        <Select label="Status Kontainer" value={item.container_status} onChange={(e) => updateTransferItem(item._key, { container_status: e.target.value })} options={containerOptions} placeholder="— Pilih —" />
                      )}
                      <Input label="Jumlah" type="number" min="1" value={item.quantity} onChange={(e) => updateTransferItem(item._key, { quantity: e.target.value })} required />
                    </div>
                  </div>
                ))}
              </div>
              <button className={styles.addItemBtn} onClick={addTransferItem} type="button">+ Tambah Produk</button>
              <Input label="Catatan (opsional)" value={transferShared.notes} onChange={(e) => setTransferShared(p => ({ ...p, notes: e.target.value }))} />
              <Button onClick={handleTransfer} loading={saving} fullWidth>Transfer Stok</Button>
            </div>
          </div>
        )}

        {/* -- Defek/Rusak (owner only) -- */}
        {!loading && tab === 'defect' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Catat Stok Rusak / Defek</h2>
            <div className={styles.form}>
              <Select label="Produk" value={defectForm.product_id} onChange={(e) => setDefectForm(p => ({ ...p, product_id: e.target.value }))} options={productOptions} placeholder="Pilih produk..." required />
              <Select label="Dari Lokasi" value={defectForm.from_location_id} onChange={(e) => setDefectForm(p => ({ ...p, from_location_id: e.target.value }))} options={locationOptions} placeholder="Pilih lokasi..." required />
              <Input label="Jumlah" type="number" min="1" value={defectForm.quantity} onChange={(e) => setDefectForm(p => ({ ...p, quantity: e.target.value }))} required />
              <Select label="Status Kontainer (opsional)" value={defectForm.container_status} onChange={(e) => setDefectForm(p => ({ ...p, container_status: e.target.value }))} options={containerOptions} placeholder="— Pilih —" />
              <Input label="Catatan (opsional)" value={defectForm.notes} onChange={(e) => setDefectForm(p => ({ ...p, notes: e.target.value }))} />
              <Button variant="danger" onClick={handleDefect} loading={saving} fullWidth>Catat Defek</Button>
            </div>
          </div>
        )}

        {/* -- Tukar Agent (owner) -- */}
        {!loading && tab === 'vendor' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Tukar Kontainer ke Agent</h2>
            <p className={styles.formSubtitle}>Serahkan kontainer kosong ke agent, terima kontainer terisi + catat biaya beli. Bisa tambah beberapa produk sekaligus.</p>
            <div className={styles.form}>
              <Select label="Lokasi (truk / gudang)" value={vendorShared.location_id} onChange={(e) => setVendorShared(p => ({ ...p, location_id: e.target.value }))} options={locationOptions} placeholder="Pilih lokasi..." required />
              <div className={styles.itemList}>
                {vendorItems.map((item) => (
                  <div key={item._key} className={styles.itemRow}>
                    <div className={styles.itemRowHeader}>
                      <Select label="Produk" value={item.product_id} onChange={(e) => updateVendorItem(item._key, { product_id: e.target.value })} options={productOptions} placeholder="Pilih produk..." required />
                      <button className={styles.removeItemBtn} onClick={() => removeVendorItem(item._key)} disabled={vendorItems.length === 1} aria-label="Hapus item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className={styles.itemRowControls2}>
                      <Input label="Jml Kosong Diserahkan" type="number" min="0" value={item.empty_quantity} onChange={(e) => updateVendorItem(item._key, { empty_quantity: e.target.value })} required />
                      <Input label="Jml Terisi Diterima" type="number" min="1" value={item.filled_quantity} onChange={(e) => updateVendorItem(item._key, { filled_quantity: e.target.value })} required />
                    </div>
                    <div className={styles.itemRowControls}>
                       <Input label="Biaya Pembelian (Rp)" currency min="0" value={item.purchase_cost} onChange={(e) => updateVendorItem(item._key, { purchase_cost: e.target.value })} required />
                    </div>
                  </div>
                ))}
              </div>
              <button className={styles.addItemBtn} onClick={addVendorItem} type="button">+ Tambah Produk</button>
              <Input label="Catatan (opsional)" value={vendorShared.notes} onChange={(e) => setVendorShared(p => ({ ...p, notes: e.target.value }))} />
              <div className={styles.vendorTotal}>
                <span>Total Biaya Pembelian</span>
                <strong>{formatCurrency(vendorItems.reduce((s, i) => s + (parseFloat(i.purchase_cost) || 0), 0))}</strong>
              </div>
              <Button onClick={handleVendorExchange} loading={saving} fullWidth>Simpan Pertukaran</Button>
            </div>
          </div>
        )}

        {/* -- Produksi (owner + kasir) -- */}
        {!loading && tab === 'production' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Produksi Isi Ulang</h2>
            <p className={styles.formSubtitle}>Isi ulang kontainer kosong menjadi terisi (produk produksi sendiri). Kontainer kosong akan berkurang otomatis.</p>
            {selfProducedOptions.length === 0 ? (
              <EmptyState message="Belum ada produk produksi sendiri. Tambahkan produk refillable dengan tipe produksi 'Produksi Sendiri'." />
            ) : (
              <div className={styles.form}>
                <Select label="Produk" value={productionForm.product_id} onChange={(e) => setProductionForm(p => ({ ...p, product_id: e.target.value }))} options={selfProducedOptions} placeholder="Pilih produk..." required />
                <Select label="Lokasi" value={productionForm.location_id} onChange={(e) => setProductionForm(p => ({ ...p, location_id: e.target.value }))} options={locationOptions} placeholder="Pilih lokasi..." required />
                <Input label="Jumlah Diisi" type="number" min="1" value={productionForm.quantity} onChange={(e) => setProductionForm(p => ({ ...p, quantity: e.target.value }))} required />
                <Input label="Biaya Produksi (Rp, opsional)" currency min="0" value={productionForm.production_cost} onChange={(e) => setProductionForm(p => ({ ...p, production_cost: e.target.value }))} />
                <Input label="Catatan (opsional)" value={productionForm.notes} onChange={(e) => setProductionForm(p => ({ ...p, notes: e.target.value }))} />
                <Button onClick={handleProduction} loading={saving} fullWidth>Simpan Produksi</Button>
              </div>
            )}
          </div>
        )}

        {/* -- Penyesuaian (owner only) -- */}
        {!loading && tab === 'adjustment' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Penyesuaian Stok</h2>
            <p className={styles.formSubtitle}>Koreksi stok sistem jika tidak sesuai kondisi fisik. Bisa sesuaikan beberapa produk sekaligus. Gunakan catatan yang jelas sebagai alasan.</p>
            <div className={styles.form}>
              <Select label="Lokasi" value={adjustShared.location_id} onChange={(e) => setAdjustShared(p => ({ ...p, location_id: e.target.value }))} options={locationOptions} placeholder="Pilih lokasi..." required />
              <div className={styles.itemList}>
                {adjustItems.map((item) => (
                  <div key={item._key} className={styles.itemRow}>
                    <div className={styles.itemRowHeader}>
                      <Select label="Produk" value={item.product_id} onChange={(e) => updateAdjustItem(item._key, { product_id: e.target.value })} options={productOptions} placeholder="Pilih produk..." required />
                      <button className={styles.removeItemBtn} onClick={() => removeAdjustItem(item._key)} disabled={adjustItems.length === 1} aria-label="Hapus item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className={styles.itemRowControls2}>
                      {products.find((p) => p.id === item.product_id)?.category === 'refillable' && (
                        <Select label="Status Kontainer" value={item.container_status} onChange={(e) => updateAdjustItem(item._key, { container_status: e.target.value })} options={containerOptions} placeholder="— Pilih —" required />
                      )}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-slate-text)', marginBottom: 6 }}>Jumlah</div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => updateAdjustItem(item._key, { direction: '+' })}
                              style={{ padding: '8px 14px', background: item.direction === '+' ? '#16a34a' : 'transparent', color: item.direction === '+' ? '#fff' : 'var(--color-slate-text)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
                            >+</button>
                            <button
                              type="button"
                              onClick={() => updateAdjustItem(item._key, { direction: '-' })}
                              style={{ padding: '8px 14px', background: item.direction === '-' ? 'var(--color-danger)' : 'transparent', color: item.direction === '-' ? '#fff' : 'var(--color-slate-text)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
                            >−</button>
                          </div>
                          <Input label="" type="number" min="1" value={item.quantity} onChange={(e) => updateAdjustItem(item._key, { quantity: e.target.value })} required />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button className={styles.addItemBtn} onClick={addAdjustItem} type="button">+ Tambah Produk</button>
              <Input label="Alasan / Catatan (wajib)" value={adjustShared.note} onChange={(e) => setAdjustShared(p => ({ ...p, note: e.target.value }))} required />
              <Button onClick={handleAdjust} loading={saving} fullWidth>Simpan Penyesuaian</Button>
            </div>
          </div>
        )}

        {/* -- Kontainer (Owner only) -- */}
        {tab === 'container_loans' && (
          <div className={styles.formCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 className={styles.formTitle} style={{ margin: 0 }}>Pinjaman Kontainer</h2>
              <Button onClick={() => setBulkLoanOpen((v) => !v)}>+ Kontainer Manual</Button>
            </div>
            <p className={styles.formSubtitle}>
              Saldo kontainer per pelanggan. <strong>Oranye:</strong> pelanggan masih memegang kontainer kami. <strong>Biru:</strong> kami memegang kontainer mereka — kembalikan terisi di pengiriman berikutnya.
            </p>

            {/* -- Bulk manual loan form -- */}
            {bulkLoanOpen && (
              <div className={styles.form} style={{ marginBottom: 24, padding: 16, background: 'var(--color-cloud-gray)', borderRadius: 12 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Input Kontainer Manual</h3>
                <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => setBulkLoanDirection('pinjam')}
                    style={{ flex: 1, padding: '10px', background: bulkLoanDirection === 'pinjam' ? 'var(--color-deep-space-violet)' : 'transparent', color: bulkLoanDirection === 'pinjam' ? '#fff' : 'var(--color-slate-text)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  >Pinjamkan ke Pelanggan</button>
                  <button
                    type="button"
                    onClick={() => setBulkLoanDirection('terima')}
                    style={{ flex: 1, padding: '10px', background: bulkLoanDirection === 'terima' ? 'var(--color-deep-space-violet)' : 'transparent', color: bulkLoanDirection === 'terima' ? '#fff' : 'var(--color-slate-text)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  >Pinjam dari Pelanggan</button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-slate-text)', margin: '4px 0 12px' }}>
                  {bulkLoanDirection === 'pinjam'
                    ? 'Kontainer kami dipinjamkan ke pelanggan — stok kontainer di lokasi ini akan berkurang.'
                    : 'Kontainer pelanggan dititipkan ke kami — stok kontainer di lokasi ini akan bertambah.'}
                </p>
                <Select
                  label="Pelanggan"
                  value={bulkLoanCustomer}
                  onChange={(e) => setBulkLoanCustomer(e.target.value)}
                  options={customers.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Pilih pelanggan..."
                  required
                />
                <Select
                  label="Lokasi"
                  value={bulkLoanLocation}
                  onChange={(e) => setBulkLoanLocation(e.target.value)}
                  options={locations.map((l) => ({ value: l.id, label: l.name }))}
                  placeholder="Pilih lokasi..."
                  required
                />
                <div className={styles.itemList}>
                  {bulkLoanItems.map((item) => (
                    <div key={item._key} className={styles.itemRow}>
                      <div className={styles.itemRowHeader}>
                        <Select
                          label="Produk"
                          value={item.product_id}
                          onChange={(e) => setBulkLoanItems((prev) => prev.map((i) => i._key === item._key ? { ...i, product_id: e.target.value } : i))}
                          options={products.filter((p) => p.category === 'refillable').map((p) => ({ value: p.id, label: `${p.name} (${p.unit})` }))}
                          placeholder="Pilih produk..."
                          required
                        />
                        <button className={styles.removeItemBtn} onClick={() => setBulkLoanItems((prev) => prev.length > 1 ? prev.filter((i) => i._key !== item._key) : prev)} disabled={bulkLoanItems.length === 1} aria-label="Hapus item">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <Select
                        label="Status Kontainer"
                        value={item.container_status}
                        onChange={(e) => setBulkLoanItems((prev) => prev.map((i) => i._key === item._key ? { ...i, container_status: e.target.value } : i))}
                        options={[{ value: 'filled', label: 'Terisi' }, { value: 'empty', label: 'Kosong' }]}
                        placeholder="Pilih status..."
                        required
                      />
                      <Input label="Jumlah" type="number" min="1" value={item.quantity} onChange={(e) => setBulkLoanItems((prev) => prev.map((i) => i._key === item._key ? { ...i, quantity: e.target.value } : i))} required />
                    </div>
                  ))}
                </div>
                <button className={styles.addItemBtn} type="button" onClick={() => setBulkLoanItems((prev) => [...prev, { _key: newKey(), product_id: '', quantity: '', container_status: '' }])}>+ Tambah Produk</button>
                <Input label="Catatan (opsional)" value={bulkLoanNote} onChange={(e) => setBulkLoanNote(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={handleBulkLoanSubmit} loading={saving} fullWidth>Simpan</Button>
                  <Button variant="secondary" onClick={() => { setBulkLoanOpen(false); setBulkLoanLocation(''); setBulkLoanCustomer(''); setBulkLoanNote(''); setBulkLoanItems([{ _key: newKey(), product_id: '', quantity: '', container_status: '' }]); setBulkLoanDirection('pinjam'); }} fullWidth>Batal</Button>
                </div>
              </div>
            )}
            {containerLoansLoading ? (
              <div className={styles.loadingWrap}><Spinner /></div>
            ) : (() => {
              // Aggregate net loans per customer+product
              type LoanEntry = { customerId: string; customerName: string; productId: string; productName: string; net: number };
              const netMap = new Map<string, LoanEntry>();
              containerLoans.forEach((loan) => {
                const key = `${loan.customerId}__${loan.productId}`;
                if (!netMap.has(key)) {
                  netMap.set(key, {
                    customerId: loan.customerId,
                    customerName: loan.customerName ?? loan.customerId,
                    productId: loan.productId,
                    productName: loan.productName ?? loan.productId,
                    net: 0,
                  });
                }
                netMap.get(key)!.net += loan.quantity;
              });
              // Show all non-zero net balances
              const allEntries = Array.from(netMap.values()).filter((e) => e.net !== 0);
              if (allEntries.length === 0) {
                return <EmptyState message="Tidak ada transaksi kontainer aktif." />;
              }
              const positiveEntries = allEntries.filter((e) => e.net > 0);
              const negativeEntries = allEntries.filter((e) => e.net < 0);

              // Group by customer
              function groupByCustomer(entries: LoanEntry[]) {
                const map = new Map<string, LoanEntry[]>();
                entries.forEach((e) => {
                  if (!map.has(e.customerId)) map.set(e.customerId, []);
                  map.get(e.customerId)!.push(e);
                });
                return map;
              }
              const positiveByCustomer = groupByCustomer(positiveEntries);
              const negativeByCustomer = groupByCustomer(negativeEntries);

              return (
                <div className={styles.containerLoansTable}>
                  {/* Net > 0: customer holds our containers */}
                  {positiveEntries.length > 0 && (
                    <>
                      <div className={styles.containerLoanSectionTitle}>
                        Pelanggan memegang kontainer kami
                      </div>
                      {Array.from(positiveByCustomer.entries()).map(([custId, entries]) => (
                        <div key={custId} className={`${styles.containerLoanGroup} ${styles.containerLoanGroupPositive}`}>
                          <div className={styles.containerLoanCustomer}>{entries[0].customerName}</div>
                          {entries.map((e) => (
                            <div key={e.productId} className={styles.containerLoanRow}>
                              <div className={styles.containerLoanInfo}>
                                <span className={styles.containerLoanProduct}>{e.productName}</span>
                                <span className={`${styles.containerLoanNet} ${styles.containerLoanNetPositive}`}>
                                  <strong>{e.net}</strong> unit belum dikembalikan
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  )}

                  {/* Net < 0: we hold customer's containers, we owe them filled containers */}
                  {negativeEntries.length > 0 && (
                    <>
                      <div className={styles.containerLoanSectionTitle}>
                        Kontainer pelanggan ada di kami
                      </div>
                      {Array.from(negativeByCustomer.entries()).map(([custId, entries]) => (
                        <div key={custId} className={`${styles.containerLoanGroup} ${styles.containerLoanGroupNegative}`}>
                          <div className={styles.containerLoanCustomer}>{entries[0].customerName}</div>
                          {entries.map((e) => (
                            <div key={e.productId} className={styles.containerLoanRow}>
                              <div className={styles.containerLoanInfo}>
                                <span className={styles.containerLoanProduct}>{e.productName}</span>
                                <span className={`${styles.containerLoanNet} ${styles.containerLoanNetNegative}`}>
                                    <strong>{Math.abs(e.net)}</strong> unit kontainer mereka ada di kami
                                  </span>
                                <span className={styles.containerLoanNoteInfo}>
                                  Kirim kembali sebagai galon terisi di pengiriman berikutnya
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Transfer stok — peringatan stok negatif */}
      <ConfirmDialog
        isOpen={transferConfirmOpen}
        onClose={() => setTransferConfirmOpen(false)}
        onConfirm={() => { setTransferConfirmOpen(false); doTransfer(); }}
        title="Stok Tidak Mencukupi"
        message={`Beberapa produk akan menghasilkan stok negatif:\n\n${transferWarnings.map((w) => `\u2022 ${w}`).join('\n')}\n\nLanjutkan transfer?`}
        confirmText="Ya, Lanjutkan"
        variant="danger"
      />

      {/* Pinjaman kontainer — peringatan stok negatif */}
      <ConfirmDialog
        isOpen={bulkLoanConfirmOpen}
        onClose={() => setBulkLoanConfirmOpen(false)}
        onConfirm={() => { setBulkLoanConfirmOpen(false); doBulkLoanSubmit(); }}
        title="Stok Tidak Mencukupi"
        message={`Beberapa kontainer akan menghasilkan stok negatif:\n\n${bulkLoanWarnings.map((w) => `\u2022 ${w}`).join('\n')}\n\nLanjutkan pencatatan pinjaman?`}
        confirmText="Ya, Lanjutkan"
        variant="danger"
      />

      {/* Batalkan pergerakan stok */}
      <ConfirmDialog
        isOpen={!!reverseTarget}
        onClose={() => setReverseTarget(null)}
        onConfirm={() => reverseTarget && handleReverseMovement(reverseTarget)}
        title="Batalkan Pergerakan Stok?"
        message={reverseTarget ? `Batalkan "${MOVEMENT_TYPE_LABELS[reverseTarget.movementType] ?? reverseTarget.movementType}" untuk ${reverseTarget.productName} (qty: ${reverseTarget.quantity})?\n\nSemua pergerakan dalam batch yang sama juga akan dibatalkan.` : ''}
        confirmText="Ya, Batalkan"
        variant="danger"
      />
    </div>
  );
}
