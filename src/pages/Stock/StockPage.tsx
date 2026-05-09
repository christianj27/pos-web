import { useState, useEffect, useCallback } from 'react';
import { stockService } from '../../services/stockService';
import { productService } from '../../services/productService';
import { locationService } from '../../services/locationService';
import { containerLoanService } from '../../services/containerLoanService';
import { Button, Badge, Input, Select, EmptyState, Spinner } from '../../components/common';
import { MOVEMENT_TYPE_LABELS } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useAuth } from '../../hooks/useAuth';
import type { StockLevel, StockMovement, Product, Location, ContainerLoan } from '../../types';
import styles from './StockPage.module.scss';

type Tab = 'levels' | 'movements' | 'receive' | 'vendor' | 'transfer' | 'defect' | 'production' | 'container_loans';
interface ReceiveItem { _key: string; product_id: string; quantity: string; container_status: string; purchase_cost: string; }
interface TransferItem { _key: string; product_id: string; quantity: string; container_status: string; }
function newKey() { return Math.random().toString(36).slice(2); }

export function StockPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const isKasir = user?.role === 'kasir';

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
  const [vendorForm, setVendorForm] = useState({ product_id: '', location_id: '', empty_quantity: '', filled_quantity: '', purchase_cost: '', notes: '' });
  const [productionForm, setProductionForm] = useState({ product_id: '', location_id: '', quantity: '', production_cost: '', notes: '' });
  const [containerLoans, setContainerLoans] = useState<ContainerLoan[]>([]);
  const [containerLoansLoading, setContainerLoansLoading] = useState(false);
  const [returnQtyMap, setReturnQtyMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const load = useCallback(async () => {
    const [lvls, mvts, prods, locs] = await Promise.all([
      stockService.getLevels().catch(() => []),
      stockService.getMovements().catch(() => []),
      productService.list().catch(() => []),
      locationService.list().catch(() => []),
    ]);
    setLevels(lvls as StockLevel[]);
    setMovements(mvts as StockMovement[]);
    setProducts((prods as Product[]).filter((p) => p.is_active));
    setLocations((locs as Location[]).filter((l) => l.is_active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const productOptions = products.map((p) => ({ value: p.id, label: `${p.name} (${p.unit})` }));
  const selfProducedOptions = products
    .filter((p) => p.category === 'refillable' && p.production_type === 'self_produced')
    .map((p) => ({ value: p.id, label: `${p.name} (${p.unit})` }));
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));
  const containerOptions = [{ value: 'filled', label: 'Terisi' }, { value: 'empty', label: 'Kosong' }];

  function resetFeedback() { setSaveError(null); setSaveSuccess(false); }

  async function handleReceive() {
    setSaving(true); resetFeedback();
    try {
      await stockService.receiveBulk({
        to_location_id: receiveShared.to_location_id,
        notes: receiveShared.notes || undefined,
        items: receiveItems.map((item) => ({
          product_id: item.product_id,
          quantity: parseInt(item.quantity),
          container_status: item.container_status || undefined,
          purchase_cost: item.purchase_cost ? parseFloat(item.purchase_cost) : undefined,
        })),
      });
      setReceiveShared({ to_location_id: '', notes: '' });
      setReceiveItems([{ _key: newKey(), product_id: '', quantity: '', container_status: '', purchase_cost: '' }]);
      setSaveSuccess(true); load();
    } catch { setSaveError('Gagal menyimpan. Periksa kembali data.'); }
    finally { setSaving(false); }
  }

  async function handleTransfer() {
    setSaving(true); resetFeedback();
    try {
      await stockService.transferBulk({
        from_location_id: transferShared.from_location_id,
        to_location_id: transferShared.to_location_id,
        notes: transferShared.notes || undefined,
        items: transferItems.map((item) => ({
          product_id: item.product_id,
          quantity: parseInt(item.quantity),
          container_status: item.container_status || undefined,
        })),
      });
      setTransferShared({ from_location_id: '', to_location_id: '', notes: '' });
      setTransferItems([{ _key: newKey(), product_id: '', quantity: '', container_status: '' }]);
      setSaveSuccess(true); load();
    } catch { setSaveError('Gagal menyimpan. Periksa kembali data.'); }
    finally { setSaving(false); }
  }

  // -- Receive item helpers --
  function updateReceiveItem(key: string, patch: Partial<ReceiveItem>) {
    setReceiveItems((prev) => prev.map((item) => item._key === key ? { ...item, ...patch } : item));
  }
  function removeReceiveItem(key: string) {
    setReceiveItems((prev) => prev.length > 1 ? prev.filter((item) => item._key !== key) : prev);
  }
  function addReceiveItem() {
    setReceiveItems((prev) => [...prev, { _key: newKey(), product_id: '', quantity: '', container_status: '', purchase_cost: '' }]);
  }

  // -- Transfer item helpers --
  function updateTransferItem(key: string, patch: Partial<TransferItem>) {
    setTransferItems((prev) => prev.map((item) => item._key === key ? { ...item, ...patch } : item));
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
        product_id: defectForm.product_id, from_location_id: defectForm.from_location_id,
        quantity: parseInt(defectForm.quantity), container_status: defectForm.container_status || undefined,
        notes: defectForm.notes || undefined,
      });
      setDefectForm({ product_id: '', from_location_id: '', quantity: '', container_status: '', notes: '' });
      setSaveSuccess(true); load();
    } catch { setSaveError('Gagal menyimpan. Periksa kembali data.'); }
    finally { setSaving(false); }
  }

  async function handleVendorExchange() {
    setSaving(true); resetFeedback();
    try {
      await stockService.vendorExchange({
        product_id: vendorForm.product_id, location_id: vendorForm.location_id,
        empty_quantity: parseInt(vendorForm.empty_quantity), filled_quantity: parseInt(vendorForm.filled_quantity),
        purchase_cost: parseFloat(vendorForm.purchase_cost), notes: vendorForm.notes || undefined,
      });
      setVendorForm({ product_id: '', location_id: '', empty_quantity: '', filled_quantity: '', purchase_cost: '', notes: '' });
      setSaveSuccess(true); load();
    } catch { setSaveError('Gagal menyimpan. Periksa kembali data.'); }
    finally { setSaving(false); }
  }

  async function handleProduction() {
    setSaving(true); resetFeedback();
    try {
      await stockService.production({
        product_id: productionForm.product_id, location_id: productionForm.location_id,
        quantity: parseInt(productionForm.quantity),
        production_cost: productionForm.production_cost ? parseFloat(productionForm.production_cost) : undefined,
        notes: productionForm.notes || undefined,
      });
      setProductionForm({ product_id: '', location_id: '', quantity: '', production_cost: '', notes: '' });
      setSaveSuccess(true); load();
    } catch { setSaveError('Gagal menyimpan. Periksa kembali data.'); }
    finally { setSaving(false); }
  }

  // --- Tab config -------------------------------------------------------------
  const tabs: { key: Tab; label: string }[] = [
    { key: 'levels',          label: 'Level Stok' },
    ...(!isKasir ? [{ key: 'movements'      as Tab, label: 'Riwayat' }] : []),
    ...(isOwner  ? [{ key: 'receive'        as Tab, label: 'Terima Stok' }] : []),
    ...(!isKasir ? [{ key: 'vendor'         as Tab, label: 'Tukar Agent' }] : []),
    ...(isOwner  ? [{ key: 'production'     as Tab, label: 'Produksi' }] : []),
    ...(!isKasir ? [{ key: 'transfer'       as Tab, label: 'Transfer' }] : []),
    ...(isOwner  ? [{ key: 'defect'         as Tab, label: 'Defek/Rusak' }] : []),
    ...(isOwner  ? [{ key: 'container_loans' as Tab, label: 'Kontainer' }] : []),
  ];

  async function loadContainerLoans() {
    setContainerLoansLoading(true);
    try {
      const loans = await containerLoanService.list();
      setContainerLoans(loans);
    } finally {
      setContainerLoansLoading(false);
    }
  }

  async function handleContainerReturn(customerId: string, productId: string, productName: string, qty: number) {
    if (qty <= 0) return;
    setSaving(true); resetFeedback();
    try {
      await containerLoanService.create({ customer_id: customerId, product_id: productId, quantity: -qty, notes: `Pengembalian manual — ${productName}` });
      setReturnQtyMap((prev) => ({ ...prev, [`${customerId}-${productId}`]: '' }));
      setSaveSuccess(true);
      loadContainerLoans();
    } catch { setSaveError('Gagal mencatat pengembalian.'); }
    finally { setSaving(false); }
  }

  // --- Levels helpers ----------------------------------------------------------
  /** Group levels by location, and within each location aggregate empty counts by unit. */
  type LocationGroup = { location_id: string; location_name: string; items: StockLevel[] };
  function groupByLocation(data: StockLevel[]): LocationGroup[] {
    const map = new Map<string, LocationGroup>();
    for (const l of data) {
      if (!map.has(l.location_id)) map.set(l.location_id, { location_id: l.location_id, location_name: l.location_name, items: [] });
      map.get(l.location_id)!.items.push(l);
    }
    return Array.from(map.values());
  }

  /** Sum empty quantities per unit across all refillable products in a location group. */
  function emptyPoolByUnit(items: StockLevel[]): Record<string, number> {
    const pool: Record<string, number> = {};
    for (const item of items) {
      if (item.product_category === 'refillable' && (item.quantity_empty ?? 0) > 0) {
        pool[item.product_unit] = (pool[item.product_unit] ?? 0) + (item.quantity_empty ?? 0);
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
                    <div key={group.location_id}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-whisper-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        {group.location_name}
                      </div>
                      <div className={styles.cardList}>
                        {group.items.map((l) => {
                          const isLow = l.product_category === 'refillable'
                            ? (l.quantity_filled ?? 0) <= 0
                            : (l.quantity_total ?? 0) <= 0;
                          return (
                            <div key={l.product_id} className={styles.card}>
                              <div className={styles.cardTop}>
                                <div className={styles.cardInfo}>
                                  <span className={styles.cardName}>{l.product_name}</span>
                                  <span className={styles.cardSub}>{l.product_unit}</span>
                                </div>
                                <div className={styles.cardBadges}>
                                  {isLow && <Badge variant="inactive">Stok Habis</Badge>}
                                  {l.product_category === 'refillable' ? (
                                    <div style={{ textAlign: 'right', fontSize: 13, lineHeight: 1.6 }}>
                                      <div><span style={{ color: 'var(--color-whisper-gray)' }}>Terisi:</span> <strong style={{ color: 'var(--color-deep-space-violet)' }}>{l.quantity_filled ?? 0}</strong></div>
                                      <div><span style={{ color: 'var(--color-whisper-gray)' }}>Kosong:</span> <strong style={{ color: 'var(--color-slate-text)' }}>{l.quantity_empty ?? 0}</strong></div>
                                    </div>
                                  ) : (
                                    <span className={styles.cardQty}>{l.quantity_total ?? 0}</span>
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
            {movements.length === 0 ? <EmptyState message="Belum ada riwayat pergerakan stok." /> : (
              <div className={styles.cardList}>
                {movements.map((m) => (
                  <div key={m.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardInfo}>
                        <span className={styles.cardName}>{m.product_name}</span>
                        <span className={styles.cardRoute}>
                          {m.from_location_name ?? '—'} → {m.to_location_name ?? '—'}
                        </span>
                      </div>
                      <div className={styles.cardBadges}>
                        <Badge variant="default">{MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type}</Badge>
                        <span className={styles.cardQty}>{m.quantity}</span>
                      </div>
                    </div>
                    <div className={styles.cardBottom}>
                      <span className={styles.cardCost}>{m.purchase_cost ? formatCurrency(m.purchase_cost) : '—'}</span>
                      <span className={styles.cardDate}>{formatDate(m.created_at)}</span>
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
            {saveSuccess && <div className={styles.successBanner}>Stok berhasil diterima.</div>}
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
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
                    <div className={styles.itemRowControls}>
                      <Select label="Status Kontainer" value={item.container_status} onChange={(e) => updateReceiveItem(item._key, { container_status: e.target.value })} options={containerOptions} placeholder="— Pilih —" />
                      <Input label="Jumlah" type="number" min="1" value={item.quantity} onChange={(e) => updateReceiveItem(item._key, { quantity: e.target.value })} required />
                    </div>
                    <Input label="Biaya Pembelian (Rp, opsional)" type="number" min="0" value={item.purchase_cost} onChange={(e) => updateReceiveItem(item._key, { purchase_cost: e.target.value })} />
                  </div>
                ))}
              </div>
              <button className={styles.addItemBtn} onClick={addReceiveItem} type="button">+ Tambah Produk</button>
              <Input label="Catatan (opsional)" value={receiveShared.notes} onChange={(e) => setReceiveShared(p => ({ ...p, notes: e.target.value }))} />
              <Button onClick={handleReceive} loading={saving} fullWidth>Terima Semua Stok</Button>
            </div>
          </div>
        )}

        {/* -- Transfer (owner + kurir) -- */}
        {!loading && tab === 'transfer' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Transfer Stok (Muat / Kembali)</h2>
            <p className={styles.formSubtitle}>Pindahkan stok antar lokasi. Gunakan untuk muat truk (gudang → kendaraan) atau barang kembali (kendaraan → gudang). Bisa tambah beberapa produk sekaligus.</p>
            {saveSuccess && <div className={styles.successBanner}>Transfer stok berhasil.</div>}
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
            <div className={styles.form}>
              <Select label="Dari Lokasi" value={transferShared.from_location_id} onChange={(e) => setTransferShared(p => ({ ...p, from_location_id: e.target.value }))} options={locationOptions} placeholder="Pilih asal..." required />
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
                    <div className={styles.itemRowControls}>
                      <Select label="Status Kontainer" value={item.container_status} onChange={(e) => updateTransferItem(item._key, { container_status: e.target.value })} options={containerOptions} placeholder="— Pilih —" />
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
            {saveSuccess && <div className={styles.successBanner}>Defek berhasil dicatat.</div>}
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
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

        {/* -- Tukar Agent (owner + kurir) -- */}
        {!loading && tab === 'vendor' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Tukar Kontainer ke Agent</h2>
            <p className={styles.formSubtitle}>Serahkan kontainer kosong ke agent, terima kontainer terisi + catat biaya beli.</p>
            {saveSuccess && <div className={styles.successBanner}>Tukar agent berhasil dicatat.</div>}
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
            <div className={styles.form}>
              <Select label="Produk" value={vendorForm.product_id} onChange={(e) => setVendorForm(p => ({ ...p, product_id: e.target.value }))} options={productOptions} placeholder="Pilih produk..." required />
              <Select label="Lokasi (truk / gudang)" value={vendorForm.location_id} onChange={(e) => setVendorForm(p => ({ ...p, location_id: e.target.value }))} options={locationOptions} placeholder="Pilih lokasi..." required />
              <Input label="Jumlah Kosong Diserahkan" type="number" min="0" value={vendorForm.empty_quantity} onChange={(e) => setVendorForm(p => ({ ...p, empty_quantity: e.target.value }))} required />
              <Input label="Jumlah Terisi Diterima" type="number" min="1" value={vendorForm.filled_quantity} onChange={(e) => setVendorForm(p => ({ ...p, filled_quantity: e.target.value }))} required />
              <Input label="Biaya Pembelian (Rp)" type="number" min="0" value={vendorForm.purchase_cost} onChange={(e) => setVendorForm(p => ({ ...p, purchase_cost: e.target.value }))} required />
              <Input label="Catatan (opsional)" value={vendorForm.notes} onChange={(e) => setVendorForm(p => ({ ...p, notes: e.target.value }))} />
              <Button onClick={handleVendorExchange} loading={saving} fullWidth>Simpan Pertukaran</Button>
            </div>
          </div>
        )}

        {/* -- Produksi (owner only) -- */}
        {!loading && tab === 'production' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Produksi Isi Ulang</h2>
            <p className={styles.formSubtitle}>Isi ulang kontainer kosong menjadi terisi (produk produksi sendiri). Kontainer kosong akan berkurang otomatis.</p>
            {saveSuccess && <div className={styles.successBanner}>Produksi berhasil dicatat.</div>}
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
            {selfProducedOptions.length === 0 ? (
              <EmptyState message="Belum ada produk produksi sendiri (self-produced). Tambahkan produk refillable dengan tipe produksi 'Produksi Sendiri'." />
            ) : (
              <div className={styles.form}>
                <Select label="Produk" value={productionForm.product_id} onChange={(e) => setProductionForm(p => ({ ...p, product_id: e.target.value }))} options={selfProducedOptions} placeholder="Pilih produk..." required />
                <Select label="Lokasi" value={productionForm.location_id} onChange={(e) => setProductionForm(p => ({ ...p, location_id: e.target.value }))} options={locationOptions} placeholder="Pilih lokasi..." required />
                <Input label="Jumlah Diisi" type="number" min="1" value={productionForm.quantity} onChange={(e) => setProductionForm(p => ({ ...p, quantity: e.target.value }))} required />
                <Input label="Biaya Produksi (Rp, opsional)" type="number" min="0" value={productionForm.production_cost} onChange={(e) => setProductionForm(p => ({ ...p, production_cost: e.target.value }))} />
                <Input label="Catatan (opsional)" value={productionForm.notes} onChange={(e) => setProductionForm(p => ({ ...p, notes: e.target.value }))} />
                <Button onClick={handleProduction} loading={saving} fullWidth>Simpan Produksi</Button>
              </div>
            )}
          </div>
        )}

        {/* -- Kontainer (Owner only) -- */}
        {tab === 'container_loans' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Pinjaman Kontainer</h2>
            <p className={styles.formSubtitle}>Daftar kontainer yang sedang dipinjam pelanggan. Catat pengembalian di sini.</p>
            {saveSuccess && <div className={styles.successBanner}>Pengembalian berhasil dicatat.</div>}
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
            {containerLoansLoading ? (
              <div className={styles.loadingWrap}><Spinner /></div>
            ) : (() => {
              // Aggregate net loans per customer+product
              type LoanKey = { customerId: string; customerName: string; productId: string; productName: string };
              const netMap = new Map<string, LoanKey & { net: number }>();
              containerLoans.forEach((loan) => {
                const key = `${loan.customer_id}__${loan.product_id}`;
                if (!netMap.has(key)) {
                  netMap.set(key, {
                    customerId: loan.customer_id,
                    customerName: loan.customer_name ?? loan.customer_id,
                    productId: loan.product_id,
                    productName: loan.product_name ?? loan.product_id,
                    net: 0,
                  });
                }
                netMap.get(key)!.net += loan.quantity;
              });
              const outstanding = Array.from(netMap.values()).filter((e) => e.net > 0);
              if (outstanding.length === 0) {
                return <EmptyState message="Tidak ada kontainer yang sedang dipinjam." />;
              }
              // Group by customer
              const byCustomer = new Map<string, typeof outstanding>();
              outstanding.forEach((e) => {
                if (!byCustomer.has(e.customerId)) byCustomer.set(e.customerId, []);
                byCustomer.get(e.customerId)!.push(e);
              });
              return (
                <div className={styles.containerLoansTable}>
                  {Array.from(byCustomer.entries()).map(([custId, entries]) => (
                    <div key={custId} className={styles.containerLoanGroup}>
                      <div className={styles.containerLoanCustomer}>{entries[0].customerName}</div>
                      {entries.map((e) => {
                        const mapKey = `${e.customerId}-${e.productId}`;
                        const inputVal = returnQtyMap[mapKey] ?? '';
                        return (
                          <div key={e.productId} className={styles.containerLoanRow}>
                            <div className={styles.containerLoanInfo}>
                              <span className={styles.containerLoanProduct}>{e.productName}</span>
                              <span className={styles.containerLoanNet}>{e.net} unit dipinjam</span>
                            </div>
                            <div className={styles.containerReturnControl}>
                              <input
                                type="number"
                                min="0"
                                max={e.net}
                                placeholder="0"
                                value={inputVal}
                                className={styles.containerReturnInput}
                                onChange={(ev) => setReturnQtyMap((prev) => ({ ...prev, [mapKey]: ev.target.value }))}
                              />
                              <Button
                                onClick={() => handleContainerReturn(e.customerId, e.productId, e.productName, parseInt(inputVal) || 0)}
                                loading={saving}
                                disabled={!inputVal || parseInt(inputVal) <= 0}
                              >
                                Catat
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
