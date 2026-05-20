import { useState, useEffect, useCallback } from 'react';
import { customerService } from '../../services/customerService';
import { productService } from '../../services/productService';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, Modal, Input, ConfirmDialog, EmptyState, Spinner } from '../../components/common';
import { formatCurrency } from '../../utils/formatCurrency';
import { useAuth } from '../../hooks/useAuth';
import { ApiError, getErrorMessage } from '../../utils/apiError';
import type { Customer, CustomerPricingItem, Product } from '../../types';
import styles from './CustomersPage.module.scss';

interface CustomerFormData { name: string; phone: string; address: string; initialDebt: string; }
const EMPTY_FORM: CustomerFormData = { name: '', phone: '', address: '', initialDebt: '' };

export function CustomersPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const { showToast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Customer CRUD
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<CustomerFormData>>({});
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Customer | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Pricing modal
  const [pricingCustomer, setPricingCustomer] = useState<Customer | null>(null);
  const [pricingItems, setPricingItems] = useState<CustomerPricingItem[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [pricingUpdates, setPricingUpdates] = useState<Record<string, string>>({});
  const [savingPricing, setSavingPricing] = useState(false);

  const load = useCallback(async () => {
    const data = await customerService.list().catch((err) => { showToast(getErrorMessage(err, 'Gagal memuat pelanggan.'), 'error'); return [] as Customer[]; });
    setCustomers(data);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditTarget(null); setFormData(EMPTY_FORM); setFormErrors({}); setModalOpen(true); }

  function openEdit(c: Customer) {
    setEditTarget(c);
    setFormData({ name: c.name, phone: c.phone ?? '', address: c.address ?? '', initialDebt: c.initialDebt != null && c.initialDebt > 0 ? String(c.initialDebt) : '' });
    setFormErrors({}); setModalOpen(true);
  }

  async function openPricing(c: Customer) {
    setPricingCustomer(c);
    const items = await customerService.getPricing(c.id).catch((err) => { showToast(getErrorMessage(err, 'Gagal memuat harga khusus.'), 'error'); return [] as CustomerPricingItem[]; });
    const prods = await productService.list().catch((err) => { showToast(getErrorMessage(err, 'Gagal memuat produk.'), 'error'); return [] as Product[]; });
    const activeRefillable = (prods as Product[]).filter((p) => p.isActive);
    setAllProducts(activeRefillable);
    const responseItems = (items as { items?: CustomerPricingItem[] })?.items;
    const safeItems = Array.isArray(responseItems) ? responseItems : [];
    setPricingItems(safeItems);
    const updates: Record<string, string> = {};
    safeItems.forEach((i) => {
      if (i.customPrice != null) updates[i.productId] = String(i.customPrice);
    });
    setPricingUpdates(updates);
  }

  function validate(): boolean {
    const e: Partial<CustomerFormData> = {};
    if (!formData.name.trim()) e.name = 'Nama pelanggan wajib diisi.';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    const initialDebt = formData.initialDebt ? parseFloat(formData.initialDebt) : undefined;
    try {
      if (editTarget) {
        await customerService.update(editTarget.id, { name: formData.name, phone: formData.phone || undefined, address: formData.address || undefined, isActive: editTarget.isActive, initialDebt });
        showToast('Pelanggan berhasil diperbarui.');
      } else {
        await customerService.create({ name: formData.name, phone: formData.phone || undefined, address: formData.address || undefined, initialDebt });
        showToast('Pelanggan berhasil dibuat.');
      }
      setModalOpen(false); load();
    } catch (err) {
      if (err instanceof ApiError && err.errors && Object.keys(err.errors).length > 0) {
        setFormErrors((p) => ({ ...p, ...Object.fromEntries(Object.entries(err.errors!).map(([k, v]) => [k, v[0]])) }));
      } else {
        showToast(getErrorMessage(err, 'Terjadi kesalahan. Silakan coba lagi.'), 'error');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      if (confirmTarget.isActive) {
        await customerService.deactivate(confirmTarget.id, { name: confirmTarget.name, phone: confirmTarget.phone || undefined, address: confirmTarget.address || undefined, isActive: false });
        showToast('Pelanggan berhasil dinonaktifkan.');
      } else {
        await customerService.reactivate(confirmTarget.id, { name: confirmTarget.name, phone: confirmTarget.phone || undefined, address: confirmTarget.address || undefined, isActive: true });
        showToast('Pelanggan berhasil diaktifkan kembali.');
      }
      setConfirmTarget(null); load();
    }
    catch (err) { showToast(getErrorMessage(err, 'Terjadi kesalahan. Silakan coba lagi.'), 'error'); }
    finally { setConfirmLoading(false); }
  }

  async function handleSavePricing() {
    if (!pricingCustomer) return;
    setSavingPricing(true);
    try {
      const items = allProducts.map((p) => ({
        productId: p.id,
        customPrice: pricingUpdates[p.id] ? parseFloat(pricingUpdates[p.id]) : undefined,
      }));
      await customerService.updatePricing(pricingCustomer.id, items);
      showToast('Harga khusus berhasil disimpan.');
      setPricingCustomer(null);
    } catch (err) {
      showToast(getErrorMessage(err, 'Terjadi kesalahan. Silakan coba lagi.'), 'error');
    } finally {
      setSavingPricing(false);
    }
  }

  function setField(field: keyof CustomerFormData, value: string) {
    setFormData((p) => ({ ...p, [field]: value }));
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Pelanggan</h1>
          {isOwner && <Button onClick={openCreate} size="sm">+ Tambah Pelanggan</Button>}
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {!loading && customers.length === 0 && (
          <EmptyState message="Belum ada pelanggan." />
        )}

        {!loading && customers.length > 0 && (
          <div className={styles.cardList}>
            {customers.map((c) => (
              <div key={c.id} className={[styles.card, !c.isActive ? styles.cardInactive : ''].join(' ')}>
                <div className={styles.cardTop}>
                  <div className={styles.cardInfo}>
                    <span className={styles.cardName}>{c.name}</span>
                    {c.phone && <span className={styles.cardSub}>{c.phone}</span>}
                    {c.address && <span className={styles.cardAddress}>{c.address}</span>}
                  </div>
                  <div className={styles.cardBadges}>
                    <Badge variant={c.isActive ? 'active' : 'inactive'}>{c.isActive ? 'Aktif' : 'Tidak Aktif'}</Badge>
                  </div>
                </div>
                {isOwner && (
                  <div className={styles.cardActions}>
                    <button className={styles.actionBtn} onClick={() => openEdit(c)}>Edit</button>
                    <button className={[styles.actionBtn, styles.pricingBtn].join(' ')} onClick={() => openPricing(c)}>Harga Khusus</button>
                    <button
                      className={[styles.actionBtn, c.isActive ? styles.deactivateBtn : styles.activateBtn].join(' ')}
                      onClick={() => setConfirmTarget(c)}
                    >
                      {c.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Pelanggan' : 'Tambah Pelanggan'}
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}
      >
        <div className={styles.form}>
          <Input label="Nama" value={formData.name} onChange={(e) => setField('name', e.target.value)} error={formErrors.name} required />
          <Input label="Telepon (opsional)" type="tel" value={formData.phone} onChange={(e) => setField('phone', e.target.value)} />
          <Input label="Alamat (opsional)" value={formData.address} onChange={(e) => setField('address', e.target.value)} />
          {isOwner && <Input label="Saldo Hutang Awal (Rp, opsional)" type="number" min="0" step="1" value={formData.initialDebt} onChange={(e) => setField('initialDebt', e.target.value)} />}
        </div>
      </Modal>

      {/* Pricing Modal */}
      <Modal isOpen={!!pricingCustomer} onClose={() => setPricingCustomer(null)} title={`Harga Khusus — ${pricingCustomer?.name}`} size="lg"
        footer={<><Button variant="ghost" onClick={() => setPricingCustomer(null)} disabled={savingPricing}>Batal</Button><Button onClick={handleSavePricing} loading={savingPricing}>Simpan Harga</Button></>}
      >
        <div className={styles.pricingInfo}>
          <p>Kosongkan kolom harga khusus untuk menggunakan harga dasar produk.</p>
        </div>
        <div className={styles.pricingTable}>
          {allProducts.map((p) => {
            const base = p.basePrice;
            const existing = pricingItems.find((i) => i.productId === p.id);
            return (
              <div key={p.id} className={styles.pricingRow}>
                <div className={styles.pricingProduct}>
                  <span className={styles.pricingProductName}>{p.name}</span>
                  <span className={styles.pricingBasePrice}>Harga dasar: {formatCurrency(base)}</span>
                </div>
                <div className={styles.pricingInput}>
                  <Input
                    label="Harga Khusus (Rp)"
                    type="number"
                    min="0"
                    placeholder={String(base)}
                    value={pricingUpdates[p.id] ?? (existing?.customPrice ? String(existing.customPrice) : '')}
                    onChange={(e) => setPricingUpdates((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={handleToggleActive}
        title={confirmTarget?.isActive ? 'Nonaktifkan Pelanggan' : 'Aktifkan Pelanggan'}
        message={confirmTarget?.isActive ? `Nonaktifkan ${confirmTarget?.name}?` : `Aktifkan kembali ${confirmTarget?.name}?`}
        confirmText={confirmTarget?.isActive ? 'Nonaktifkan' : 'Aktifkan'} loading={confirmLoading} />
    </div>
  );
}
