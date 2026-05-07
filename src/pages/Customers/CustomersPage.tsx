import { useState, useEffect, useCallback } from 'react';
import { customerService } from '../../services/customerService';
import { productService } from '../../services/productService';
import { Button, Badge, Modal, Input, ConfirmDialog, EmptyState, Spinner } from '../../components/common';
import { formatCurrency } from '../../utils/formatCurrency';
import { useAuth } from '../../hooks/useAuth';
import type { Customer, CustomerPricingItem, Product } from '../../types';
import styles from './CustomersPage.module.scss';

interface CustomerFormData { name: string; phone: string; address: string; }
const EMPTY_FORM: CustomerFormData = { name: '', phone: '', address: '' };

export function CustomersPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
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
    try {
      const data = await customerService.list();
      setCustomers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditTarget(null); setFormData(EMPTY_FORM); setFormErrors({}); setModalOpen(true); }

  function openEdit(c: Customer) {
    setEditTarget(c);
    setFormData({ name: c.name, phone: c.phone ?? '', address: c.address ?? '' });
    setFormErrors({}); setModalOpen(true);
  }

  async function openPricing(c: Customer) {
    setPricingCustomer(c);
    const [items, prods] = await Promise.all([
      customerService.getPricing(c.id).catch(() => [] as CustomerPricingItem[]),
      productService.list().catch(() => [] as Product[]),
    ]);
    const activeRefillable = (prods as Product[]).filter((p) => p.is_active);
    setAllProducts(activeRefillable);
    setPricingItems(items as CustomerPricingItem[]);
    const updates: Record<string, string> = {};
    (items as CustomerPricingItem[]).forEach((i) => {
      if (i.custom_price != null) updates[i.product_id] = String(i.custom_price);
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
    try {
      if (editTarget) {
        await customerService.update(editTarget.id, { name: formData.name, phone: formData.phone || undefined, address: formData.address || undefined });
      } else {
        await customerService.create({ name: formData.name, phone: formData.phone || undefined, address: formData.address || undefined });
      }
      setModalOpen(false); load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try { await customerService.deactivate(confirmTarget.id); setConfirmTarget(null); load(); }
    finally { setConfirmLoading(false); }
  }

  async function handleSavePricing() {
    if (!pricingCustomer) return;
    setSavingPricing(true);
    try {
      const items = allProducts.map((p) => ({
        product_id: p.id,
        custom_price: pricingUpdates[p.id] ? parseFloat(pricingUpdates[p.id]) : undefined,
      }));
      await customerService.updatePricing(pricingCustomer.id, items);
      setPricingCustomer(null);
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
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Telepon</th>
                  <th>Alamat</th>
                  <th>Status</th>
                  {isOwner && <th>Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className={!c.is_active ? styles.inactiveRow : ''}>
                    <td className={styles.nameCell}>{c.name}</td>
                    <td>{c.phone ?? '—'}</td>
                    <td className={styles.addressCell}>{c.address ?? '—'}</td>
                    <td><Badge variant={c.is_active ? 'active' : 'inactive'}>{c.is_active ? 'Aktif' : 'Tidak Aktif'}</Badge></td>
                    {isOwner && (
                      <td>
                        <div className={styles.actions}>
                          <button className={styles.actionBtn} onClick={() => openEdit(c)}>Edit</button>
                          <button className={[styles.actionBtn, styles.pricingBtn].join(' ')} onClick={() => openPricing(c)}>Harga</button>
                          {c.is_active && <button className={[styles.actionBtn, styles.deactivateBtn].join(' ')} onClick={() => setConfirmTarget(c)}>Nonaktifkan</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
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
            const base = p.base_price;
            const existing = pricingItems.find((i) => i.product_id === p.id);
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
                    value={pricingUpdates[p.id] ?? (existing?.custom_price ? String(existing.custom_price) : '')}
                    onChange={(e) => setPricingUpdates((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={handleDeactivate}
        title="Nonaktifkan Pelanggan" message={`Nonaktifkan ${confirmTarget?.name}?`} confirmText="Nonaktifkan" loading={confirmLoading} />
    </div>
  );
}
