import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { customerService } from '../../services/customerService';
import { productService } from '../../services/productService';
import { useToast } from '../../context/ToastContext';
import { Modal, Button, Input, Select, Badge, Spinner } from '../common';
import { formatCurrency } from '../../utils/formatCurrency';
import { getErrorMessage } from '../../utils/apiError';
import type { Product, ProductCustomerPricing } from '../../types';
import styles from './BulkPricingAdjustModal.module.scss';

interface BulkPricingAdjustModalProps {
  onClose: () => void;
  onApplied?: () => void;
  /** Preselected product; required when `lockProduct` is set. */
  initialProductId?: string;
  /** Signed amount to prefill, e.g. `new base price − old base price`. */
  initialAmount?: number;
  /** Hide the product dropdown (opened from the Produk page after a base price change). */
  lockProduct?: boolean;
}

/**
 * FR-CST-012 — shift every selected customer's custom price for one product by a fixed signed amount.
 * Mount it conditionally: state is seeded from the props once, on mount.
 */
export function BulkPricingAdjustModal({
  onClose, onApplied, initialProductId = '', initialAmount = 0, lockProduct = false,
}: BulkPricingAdjustModalProps) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState(initialProductId);
  const [direction, setDirection] = useState<1 | -1>(initialAmount < 0 ? -1 : 1);
  const [amount, setAmount] = useState(initialAmount !== 0 ? String(Math.abs(initialAmount)) : '');
  const [pricing, setPricing] = useState<ProductCustomerPricing | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [applyError, setApplyError] = useState('');
  const [applying, setApplying] = useState(false);

  const loadProducts = useCallback(async () => {
    if (lockProduct) return;
    try {
      const all = await productService.list();
      setProducts(all.filter((p) => p.isActive));
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memuat produk.'), 'error');
    }
  }, [lockProduct, showToast]);

  const loadPricing = useCallback(async () => {
    if (!productId) return;
    setLoadError(false);
    try {
      const data = await customerService.getPricingByProduct(productId);
      setPricing(data);
    } catch {
      setLoadError(true);
    }
  }, [productId]);

  useEffect(() => { void Promise.resolve().then(loadProducts); }, [loadProducts]);
  useEffect(() => { void Promise.resolve().then(loadPricing); }, [loadPricing]);

  function handleProductChange(next: string) {
    setProductId(next);
    setPricing(null);
    setExcluded(new Set());
    setApplyError('');
  }

  function toggle(customerId: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId); else next.add(customerId);
      return next;
    });
  }

  // A payload only renders while it belongs to the selected product.
  const rows = pricing && pricing.productId === productId ? pricing.items : null;
  const signedAmount = direction * (parseFloat(amount) || 0);
  const selected = rows?.filter((r) => !excluded.has(r.customerId)) ?? [];
  const allSelected = !!rows && rows.length > 0 && selected.length === rows.length;
  const hasInvalid = selected.some((r) => r.customPrice + signedAmount <= 0);

  function toggleAll() {
    setExcluded(allSelected ? new Set(rows?.map((r) => r.customerId)) : new Set());
  }

  async function handleApply() {
    setApplyError('');
    if (signedAmount === 0) { setApplyError('Nominal penyesuaian tidak boleh nol.'); return; }
    if (selected.length === 0) { setApplyError('Pilih minimal satu pelanggan.'); return; }
    setApplying(true);
    try {
      const result = await customerService.bulkAdjustPricing({
        productId,
        amount: signedAmount,
        customerIds: selected.map((r) => r.customerId),
      });
      showToast(`Harga khusus ${result.updatedCount} pelanggan berhasil diperbarui.`);
      onApplied?.();
      onClose();
    } catch (err) {
      setApplyError(getErrorMessage(err, 'Terjadi kesalahan. Silakan coba lagi.'));
    } finally {
      setApplying(false);
    }
  }

  let list: ReactNode;
  if (!productId) {
    list = <p className={styles.muted}>Pilih produk untuk melihat pelanggan dengan harga khusus.</p>;
  } else if (!rows) {
    list = loadError
      ? <p className={styles.errorText}>Gagal memuat harga khusus.</p>
      : <div className={styles.loadingWrap}><Spinner /></div>;
  } else if (rows.length === 0) {
    list = <p className={styles.muted}>Belum ada pelanggan dengan harga khusus untuk produk ini.</p>;
  } else {
    list = (
      <>
        <label className={styles.selectAll}>
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          Pilih semua ({selected.length}/{rows.length})
        </label>
        <ul className={styles.list}>
          {rows.map((r) => {
            const checked = !excluded.has(r.customerId);
            const newPrice = r.customPrice + signedAmount;
            const invalid = newPrice <= 0;
            return (
              <li key={r.customerId} className={[styles.row, invalid && checked ? styles.rowInvalid : ''].join(' ')}>
                <label className={styles.rowLabel}>
                  <input type="checkbox" checked={checked} onChange={() => toggle(r.customerId)} />
                  <span className={styles.rowName}>
                    {r.customerName}
                    {r.isConfidential && <Badge variant="confidential">Konfidensial</Badge>}
                  </span>
                </label>
                <span className={styles.rowPrice}>
                  <span className={styles.oldPrice}>{formatCurrency(r.customPrice)}</span>
                  {signedAmount !== 0 && (
                    <>
                      <span aria-hidden="true">→</span>
                      <span className={invalid ? styles.newPriceInvalid : styles.newPrice}>{formatCurrency(newPrice)}</span>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Sesuaikan Harga Khusus"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={applying}>{lockProduct ? 'Lewati' : 'Batal'}</Button>
          <Button onClick={handleApply} loading={applying} disabled={!rows || selected.length === 0 || signedAmount === 0 || hasInvalid}>
            Terapkan ke {selected.length} pelanggan
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {lockProduct ? (
          <p className={styles.intro}>
            Harga dasar <strong>{pricing?.productName ?? 'produk'}</strong> berubah. Terapkan selisihnya ke harga khusus pelanggan?
          </p>
        ) : (
          <Select
            label="Produk"
            value={productId}
            onChange={(e) => handleProductChange(e.target.value)}
            options={products.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Pilih produk..."
          />
        )}
        {pricing && pricing.productId === productId && (
          <p className={styles.muted}>Harga dasar saat ini: {formatCurrency(pricing.basePrice)} / {pricing.unit}</p>
        )}

        <div className={styles.amountRow}>
          <div className={styles.directionGroup} role="group" aria-label="Arah penyesuaian">
            <button type="button" aria-pressed={direction === 1}
              className={[styles.directionBtn, direction === 1 ? styles.directionActive : ''].join(' ')}
              onClick={() => setDirection(1)}>+ Naikkan</button>
            <button type="button" aria-pressed={direction === -1}
              className={[styles.directionBtn, direction === -1 ? styles.directionActive : ''].join(' ')}
              onClick={() => setDirection(-1)}>− Turunkan</button>
          </div>
          <Input label="Nominal (Rp)" currency min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        {list}

        {hasInvalid && <p className={styles.errorText}>Harga khusus yang ditandai merah akan menjadi Rp 0 atau kurang.</p>}
        {applyError && <p className={styles.errorText}>{applyError}</p>}
      </div>
    </Modal>
  );
}
