import { useState, useEffect, useCallback } from 'react';
import { stockService } from '../../services/stockService';
import { productService } from '../../services/productService';
import { locationService } from '../../services/locationService';
import { Button, Badge, Input, Select, EmptyState, Spinner } from '../../components/common';
import { CONTAINER_STATUS_LABELS, MOVEMENT_TYPE_LABELS } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useAuth } from '../../hooks/useAuth';
import type { StockLevel, StockMovement, Product, Location } from '../../types';
import styles from './StockPage.module.scss';

type Tab = 'levels' | 'movements' | 'receive' | 'transfer' | 'defect' | 'vendor';

export function StockPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const isKurir = user?.role === 'kurir';

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
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));
  const containerOptions = [{ value: 'filled', label: 'Terisi' }, { value: 'empty', label: 'Kosong' }];

  async function handleReceive() {
    setSaving(true); setSaveError(null); setSaveSuccess(false);
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
    setSaving(true); setSaveError(null); setSaveSuccess(false);
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
    setSaving(true); setSaveError(null); setSaveSuccess(false);
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
    setSaving(true); setSaveError(null); setSaveSuccess(false);
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'levels',    label: 'Level Stok' },
    { key: 'movements', label: 'Riwayat' },
    { key: 'receive',   label: 'Terima Stok' },
    { key: 'transfer',  label: 'Transfer' },
    ...(isOwner || isKurir ? [{ key: 'defect' as Tab, label: 'Defek/Rusak' }] : []),
    ...(isOwner || isKurir ? [{ key: 'vendor' as Tab, label: 'Tukar Vendor' }] : []),
  ];

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
              onClick={() => { setTab(t.key); setSaveError(null); setSaveSuccess(false); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {!loading && tab === 'levels' && (
          <>
            {levels.length === 0 ? (
              <EmptyState message="Belum ada data stok." />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Produk</th><th>Lokasi</th><th>Status</th><th>Jumlah</th></tr>
                  </thead>
                  <tbody>
                    {levels.map((l, i) => (
                      <tr key={i}>
                        <td className={styles.nameCell}>{l.product_name} <span className={styles.unit}>({l.product_unit})</span></td>
                        <td>{l.location_name}</td>
                        <td>{l.container_status ? <Badge variant={l.container_status}>{CONTAINER_STATUS_LABELS[l.container_status]}</Badge> : '—'}</td>
                        <td className={styles.qtyCell}>{l.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!loading && tab === 'movements' && (
          <>
            {movements.length === 0 ? <EmptyState message="Belum ada riwayat pergerakan stok." /> : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Tipe</th><th>Produk</th><th>Dari</th><th>Ke</th><th>Jumlah</th><th>Biaya</th><th>Waktu</th></tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td><Badge variant="default">{MOVEMENT_TYPE_LABELS[m.movement_type] ?? m.movement_type}</Badge></td>
                        <td className={styles.nameCell}>{m.product_name}</td>
                        <td>{m.from_location_name ?? '—'}</td>
                        <td>{m.to_location_name ?? '—'}</td>
                        <td className={styles.qtyCell}>{m.quantity}</td>
                        <td>{m.purchase_cost ? formatCurrency(m.purchase_cost) : '—'}</td>
                        <td className={styles.dateCell}>{formatDate(m.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!loading && tab === 'receive' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Terima Stok Baru</h2>
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

        {!loading && tab === 'vendor' && (
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Tukar Kontainer ke Vendor</h2>
            <p className={styles.formSubtitle}>Serahkan kontainer kosong ke vendor, terima kontainer terisi + catat biaya beli.</p>
            {saveSuccess && <div className={styles.successBanner}>Tukar vendor berhasil dicatat.</div>}
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
      </div>
    </div>
  );
}
