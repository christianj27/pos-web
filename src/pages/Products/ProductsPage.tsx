import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../../services/productService';
import { Button, Badge, Modal, Input, Select, ConfirmDialog, EmptyState, Spinner } from '../../components/common';
import { PRODUCT_CATEGORY_LABELS, PRODUCT_TYPE_LABELS, UNIT_OPTIONS } from '../../utils/constants';
import { formatCurrency } from '../../utils/formatCurrency';
import type { Product, ProductCategory } from '../../types';
import styles from './ProductsPage.module.scss';

interface ProductFormData {
  name: string;
  category: string;
  production_type: string;
  type: string;
  unit: string;
  base_price: string;
}

const EMPTY_FORM: ProductFormData = { name: '', category: '', production_type: '', type: '', unit: '', base_price: '' };
const CATEGORY_OPTIONS = [{ value: 'simple', label: 'Sederhana' }, { value: 'refillable', label: 'Refillable' }];
const PRODUCTION_OPTIONS = [{ value: 'purchased', label: 'Beli dari Vendor' }, { value: 'self_produced', label: 'Produksi Sendiri' }];
const TYPE_OPTIONS = [{ value: 'air', label: 'Air' }, { value: 'gas', label: 'Gas' }];

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<ProductFormData>>({});
  const [saving, setSaving] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Product | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await productService.list();
      setProducts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null); setFormData(EMPTY_FORM); setFormErrors({}); setModalOpen(true);
  }

  function openEdit(p: Product) {
    setEditTarget(p);
    setFormData({
      name: p.name, category: p.category, production_type: p.production_type ?? '',
      type: p.type, unit: p.unit, base_price: String(p.base_price),
    });
    setFormErrors({}); setModalOpen(true);
  }

  function validate(): boolean {
    const e: Partial<ProductFormData> = {};
    if (!formData.name.trim()) e.name = 'Nama produk wajib diisi.';
    else if (formData.name.length > 100) e.name = 'Nama produk tidak boleh lebih dari 100 karakter.';
    if (!editTarget && !formData.category) e.category = 'Kategori produk wajib dipilih.';
    if ((editTarget?.category === 'refillable' || formData.category === 'refillable') && !formData.production_type)
      e.production_type = 'Tipe produksi wajib dipilih untuk produk refillable.';
    if (!formData.type) e.type = 'Jenis produk wajib dipilih.';
    if (!formData.unit.trim()) e.unit = 'Satuan wajib diisi.';
    const price = parseFloat(formData.base_price);
    if (!formData.base_price) e.base_price = 'Harga dasar wajib diisi.';
    else if (isNaN(price) || price <= 0) e.base_price = 'Harga dasar harus berupa angka positif.';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await productService.update(editTarget.id, {
          name: formData.name,
          production_type: formData.production_type || undefined,
          type: formData.type as 'air' | 'gas',
          unit: formData.unit,
          base_price: parseFloat(formData.base_price),
        });
      } else {
        await productService.create({
          name: formData.name,
          category: formData.category,
          production_type: formData.production_type || undefined,
          type: formData.type,
          unit: formData.unit,
          base_price: parseFloat(formData.base_price),
        });
      }
      setModalOpen(false); load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      await productService.deactivate(confirmTarget.id);
      setConfirmTarget(null); load();
    } finally {
      setConfirmLoading(false);
    }
  }

  function setField(field: keyof ProductFormData, value: string) {
    setFormData((p) => ({ ...p, [field]: value }));
  }

  const isRefillable = formData.category === 'refillable' || editTarget?.category === 'refillable';

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <button className={styles.backArrow} onClick={() => navigate('/settings')} aria-label="Kembali ke Pengaturan">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className={styles.title}>Produk</h1>
          </div>
          <Button onClick={openCreate} size="sm">+ Tambah Produk</Button>
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {!loading && products.length === 0 && (
          <EmptyState message="Belum ada produk. Tambahkan produk air atau gas pertama Anda." />
        )}

        {!loading && products.length > 0 && (
          <div className={styles.cardList}>
            {products.map((p) => (
              <div key={p.id} className={[styles.card, !p.is_active ? styles.cardInactive : ''].join(' ')}>
                <div className={styles.cardTop}>
                  <div className={styles.cardInfo}>
                    <span className={styles.cardName}>{p.name}</span>
                    <span className={styles.cardPrice}>{formatCurrency(p.base_price)} / {p.unit}</span>
                  </div>
                  <div className={styles.cardBadges}>
                    <Badge variant={p.category as ProductCategory}>{PRODUCT_CATEGORY_LABELS[p.category]}</Badge>
                    <Badge variant={p.type}>{PRODUCT_TYPE_LABELS[p.type]}</Badge>
                    <Badge variant={p.is_active ? 'active' : 'inactive'}>{p.is_active ? 'Aktif' : 'Tidak Aktif'}</Badge>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.actionBtn} onClick={() => openEdit(p)}>Edit</button>
                  {p.is_active && (
                    <button className={[styles.actionBtn, styles.deactivateBtn].join(' ')} onClick={() => setConfirmTarget(p)}>Nonaktifkan</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Edit Produk' : 'Tambah Produk'}
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button><Button onClick={handleSave} loading={saving}>Simpan</Button></>}
      >
        <div className={styles.form}>
          <Input label="Nama Produk" value={formData.name} onChange={(e) => setField('name', e.target.value)} error={formErrors.name} required />
          {!editTarget ? (
            <Select label="Kategori" value={formData.category} onChange={(e) => setField('category', e.target.value)} options={CATEGORY_OPTIONS} placeholder="Pilih kategori..." error={formErrors.category} required />
          ) : (
            <div className={styles.infoRow}><span className={styles.infoLabel}>Kategori:</span><Badge variant={editTarget.category as ProductCategory}>{PRODUCT_CATEGORY_LABELS[editTarget.category]}</Badge></div>
          )}
          {isRefillable && (
            <Select label="Tipe Produksi" value={formData.production_type} onChange={(e) => setField('production_type', e.target.value)} options={PRODUCTION_OPTIONS} placeholder="Pilih tipe produksi..." error={formErrors.production_type} required />
          )}
          <Select label="Jenis" value={formData.type} onChange={(e) => setField('type', e.target.value)} options={TYPE_OPTIONS} placeholder="Pilih jenis..." error={formErrors.type} required />
          <Select label="Satuan" value={formData.unit} onChange={(e) => setField('unit', e.target.value)} options={UNIT_OPTIONS} placeholder="Pilih satuan..." error={formErrors.unit} required />
          <Input label="Harga Dasar (Rp)" type="number" min="0" value={formData.base_price} onChange={(e) => setField('base_price', e.target.value)} error={formErrors.base_price} required />
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!confirmTarget} onClose={() => setConfirmTarget(null)} onConfirm={handleDeactivate}
        title="Nonaktifkan Produk" message={`Nonaktifkan ${confirmTarget?.name}? Produk tidak akan muncul di formulir baru.`} confirmText="Nonaktifkan" loading={confirmLoading} />
    </div>
  );
}
