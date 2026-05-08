import { useState, useEffect, useCallback } from 'react';
import { stockService } from '../../services/stockService';
import { productService } from '../../services/productService';
import { locationService } from '../../services/locationService';
import { Button, Badge, Input, Select, EmptyState, Spinner } from '../../components/common';
import { MOVEMENT_TYPE_LABELS } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useAuth } from '../../hooks/useAuth';
import type { StockLevel, StockMovement, Product, Location } from '../../types';
import styles from './StockPage.module.scss';

type Tab = 'levels' | 'movements' | 'receive' | 'vendor' | 'transfer' | 'defect' | 'production';

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

  // Forms
  const [receiveForm, setReceiveForm] = useState({ product_id: '', to_location_id: '', quantity: '', container_status: '', purchase_cost: '', notes: '' });
  const [transferForm, setTransferForm] = useState({ product_id: '', from_location_id: '', to_location_id: '', quantity: '', container_status: '', notes: '' });
  const [defectForm, setDefectForm] = useState({ product_id: '', from_location_id: '', quantity: '', container_status: '', notes: '' });
  const [vendorForm, setVendorForm] = useState({ product_id: '', location_id: '', empty_quantity: '', filled_quantity: '', purchase_cost: '', notes: '' });
  const [productionForm, setProductionForm] = useState({ product_id: '', location_id: '', quantity: '', production_cost: '', notes: '' });
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
      await stockService.receive({
        product_id: receiveForm.product_id, to_location_id: receiveForm.to_location_id,
        quantity: parseInt(receiveForm.quantity), container_status: receiveForm.container_status || undefined,
        purchase_cost: receiveForm.purchase_cost ? parseFloat(receiveForm.purchase_cost) : undefined,
        notes: receiveForm.notes || undefined,
      });
      setReceiveForm({ product_id: '', to_location_id: '', quantity: '', container_status: '', purchase_cost: '', notes: '' });
      setSaveSuccess(true); load();
    } catch { setSaveError('Gagal menyimpan. Periksa kembali data.'); }
    finally { setSaving(false); }
  }

  async function handleTransfer() {
    setSaving(true); resetFeedback();
    try {
      await stockService.transfer({
        product_id: transferForm.product_id, from_location_id: transferForm.from_location_id,
        to_location_id: transferForm.to_location_id, quantity: parseInt(transferForm.quantity),
        container_status: transferForm.container_status || undefined, notes: transferForm.notes || undefined,
      });
      setTransferForm({ product_id: '', from_location_id: '', to_location_id: '', quantity: '', container_status: '', notes: '' });
      setSaveSuccess(true); load();
    } catch { setSaveError('Gagal menyimpan. Periksa kembali data.'); }
    finally { setSaving(false); }
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
    { key: 'levels',     label: 'Level Stok' },
    ...(!isKasir ? [{ key: 'movements' as Tab, label: 'Riwayat' }] : []),
    ...(isOwner  ? [{ key: 'receive'    as Tab, label: 'Terima Stok' }] : []),
    ...(!isKasir ? [{ key: 'vendor'     as Tab, label: 'Tukar Agent' }] : []),
    ...(!isKasir ? [{ key: 'transfer'   as Tab, label: 'Transfer' }] : []),
    ...(isOwner  ? [{ key: 'defect'     as Tab, label: 'Defek/Rusak' }] : []),
    ...(isOwner  ? [{ key: 'production' as Tab, label: 'Produksi' }] : []),
  ];

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
              onClick={() => { setTab(t.key); resetFeedback(); }}
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
            <p className={styles.formSubtitle}>Stok baru dari luar sistem (pembelian, stok awal). Tidak memotong kontainer kosong.</p>
            {saveSuccess && <div className={styles.successBanner}>Stok berhasil diterima.</div>}
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
            <div className={styles.form}>
              <Select label="Produk" value={receiveForm.product_id} onChange={(e) => setReceiveForm(p => ({ ...p, product_id: e.target.value }))} options={productOptions} placeholder="Pilih produk..." required />
              <Select label="Lokasi Tujuan" value={receiveForm.to_location_id} onChange={(e) => setReceiveForm(p => ({ ...p, to_location_id: e.target.value }))} options={locationOptions} placeholder="Pilih lokasi..." required />
              <Input label="Jumlah" type="number" min="1" value={receiveForm.quantity} onChange={(e) => setReceiveForm(p => ({ ...p, quantity: e.target.value }))} required />
              <Select label="Status Kontainer (opsional)" value={receiveForm.container_status} onChange={(e) => setReceiveForm(p => ({ ...p, container_status: e.target.value }))} options={containerOptions} placeholder="— Pilih —" />
              <Input label="Biaya Pembelian (Rp, opsional)" type="number" min="0" value={receiveForm.purchase_cost} onChange={(e) => setReceiveForm(p => ({ ...p, purchase_cost: e.target.value }))} />
              <Input label="Catatan (opsional)" value={receiveForm.notes} onChange={(e) => setReceiveForm(p => ({ ...p, notes: e.target.value }))} />
              <Button onClick={handleReceive} loading={saving} fullWidth>Simpan</Button>
            </div>
          </div>
        )}

        {/* -- Transfer (owner + kurir) -- */}
        {!loading && tab === 'transfer' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Transfer Stok (Muat / Kembali)</h2>
            {saveSuccess && <div className={styles.successBanner}>Transfer stok berhasil.</div>}
            {saveError && <div className={styles.errorBanner}>{saveError}</div>}
            <div className={styles.form}>
              <Select label="Produk" value={transferForm.product_id} onChange={(e) => setTransferForm(p => ({ ...p, product_id: e.target.value }))} options={productOptions} placeholder="Pilih produk..." required />
              <Select label="Dari Lokasi" value={transferForm.from_location_id} onChange={(e) => setTransferForm(p => ({ ...p, from_location_id: e.target.value }))} options={locationOptions} placeholder="Pilih asal..." required />
              <Select label="Ke Lokasi" value={transferForm.to_location_id} onChange={(e) => setTransferForm(p => ({ ...p, to_location_id: e.target.value }))} options={locationOptions} placeholder="Pilih tujuan..." required />
              <Input label="Jumlah" type="number" min="1" value={transferForm.quantity} onChange={(e) => setTransferForm(p => ({ ...p, quantity: e.target.value }))} required />
              <Select label="Status Kontainer (opsional)" value={transferForm.container_status} onChange={(e) => setTransferForm(p => ({ ...p, container_status: e.target.value }))} options={containerOptions} placeholder="— Pilih —" />
              <Input label="Catatan (opsional)" value={transferForm.notes} onChange={(e) => setTransferForm(p => ({ ...p, notes: e.target.value }))} />
              <Button onClick={handleTransfer} loading={saving} fullWidth>Simpan</Button>
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
      </div>
    </div>
  );
}
