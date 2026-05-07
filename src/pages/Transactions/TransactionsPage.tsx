import { useState, useEffect, useCallback } from 'react';
import { transactionService } from '../../services/transactionService';
import { productService } from '../../services/productService';
import { customerService } from '../../services/customerService';
import { locationService } from '../../services/locationService';
import { Button, Badge, Modal, Input, Select, EmptyState, Spinner } from '../../components/common';
import { TRANSACTION_TYPE_LABELS, TRANSACTION_STATUS_LABELS } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useAuth } from '../../hooks/useAuth';
import type { Transaction, Product, Customer, Location } from '../../types';
import styles from './TransactionsPage.module.scss';

interface CartItem { product_id: string; product_name: string; quantity: number; unit_price: number; }

export function TransactionsPage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const isOwner = role === 'owner';
  const isKurir = role === 'kurir';
  const isKasir = role === 'kasir';

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [paymentTx, setPaymentTx] = useState<Transaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // New transaction form
  const defaultType = isKurir ? 'delivery' : isKasir ? 'counter' : 'counter';
  const [txType, setTxType] = useState(defaultType);
  const [customerId, setCustomerId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [addProductId, setAddProductId] = useState('');
  const [addQty, setAddQty] = useState('1');

  const load = useCallback(async () => {
    const [txs, prods, custs, locs] = await Promise.all([
      transactionService.list().catch(() => []),
      productService.list().catch(() => []),
      customerService.list().catch(() => []),
      locationService.list().catch(() => []),
    ]);
    setTransactions(txs as Transaction[]);
    setProducts((prods as Product[]).filter((p) => p.is_active));
    setCustomers((custs as Customer[]).filter((c) => c.is_active));
    setLocations((locs as Location[]).filter((l) => l.is_active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setCart([]); setCustomerId(''); setLocationId('');
    setPaidAmount(''); setTxType(defaultType);
    setAddProductId(''); setAddQty('1');
    setSaveError(null); setCreateOpen(true);
  }

  function addToCart() {
    const prod = products.find((p) => p.id === addProductId);
    if (!prod) return;
    const existing = cart.find((c) => c.product_id === prod.id);
    if (existing) {
      setCart(cart.map((c) => c.product_id === prod.id ? { ...c, quantity: c.quantity + parseInt(addQty || '1') } : c));
    } else {
      setCart([...cart, { product_id: prod.id, product_name: prod.name, quantity: parseInt(addQty || '1'), unit_price: prod.base_price }]);
    }
    setAddProductId(''); setAddQty('1');
  }

  function removeFromCart(productId: string) {
    setCart(cart.filter((c) => c.product_id !== productId));
  }

  function updateCartPrice(productId: string, price: string) {
    setCart(cart.map((c) => c.product_id === productId ? { ...c, unit_price: parseFloat(price) || 0 } : c));
  }

  function updateCartQty(productId: string, qty: string) {
    setCart(cart.map((c) => c.product_id === productId ? { ...c, quantity: parseInt(qty) || 1 } : c));
  }

  const total = cart.reduce((sum, c) => sum + c.quantity * c.unit_price, 0);

  async function handleCreate() {
    if (cart.length === 0) { setSaveError('Tambahkan minimal satu produk.'); return; }
    setSaving(true); setSaveError(null);
    try {
      await transactionService.create({
        type: txType,
        customer_id: customerId || undefined,
        location_id: locationId || undefined,
        items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: c.unit_price })),
        paid_amount: parseFloat(paidAmount) || 0,
      });
      setCreateOpen(false); load();
    } catch { setSaveError('Gagal menyimpan transaksi.'); }
    finally { setSaving(false); }
  }

  async function handleAddPayment() {
    if (!paymentTx || !paymentAmount) return;
    setSaving(true);
    try {
      await transactionService.addPayment(paymentTx.id, parseFloat(paymentAmount));
      setPaymentTx(null); setPaymentAmount(''); load();
    } finally { setSaving(false); }
  }

  const typeOptions = [
    ...(isOwner || isKasir ? [{ value: 'counter', label: 'Kasir (Counter)' }] : []),
    ...(isOwner || isKurir ? [{ value: 'delivery', label: 'Pengiriman' }] : []),
    ...(isOwner || isKasir ? [{ value: 'vendor_direct', label: 'Vendor Langsung' }] : []),
  ];
  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));
  const locationOptions = locations.map((l) => ({ value: l.id, label: l.name }));
  const productOptions = products.map((p) => ({ value: p.id, label: `${p.name} (${p.unit})` }));

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Transaksi</h1>
          <Button onClick={openCreate} size="sm">+ Transaksi Baru</Button>
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {!loading && transactions.length === 0 && <EmptyState message="Belum ada transaksi." />}

        {!loading && transactions.length > 0 && (
          <div className={styles.txList}>
            {transactions.map((tx) => (
              <div key={tx.id} className={styles.txCard}>
                <div className={styles.txTop}>
                  <div className={styles.txMeta}>
                    <Badge variant={tx.type as 'delivery' | 'counter' | 'vendor_direct'}>{TRANSACTION_TYPE_LABELS[tx.type]}</Badge>
                    <Badge variant={tx.status as 'pending' | 'completed' | 'cancelled'}>{TRANSACTION_STATUS_LABELS[tx.status]}</Badge>
                  </div>
                  <span className={styles.txDate}>{formatDate(tx.created_at)}</span>
                </div>
                <div className={styles.txBody}>
                  {tx.customer_name && <p className={styles.txCustomer}>{tx.customer_name}</p>}
                  {tx.location_name && <p className={styles.txLocation}>{tx.location_name}</p>}
                  <div className={styles.txAmounts}>
                    <div>
                      <span className={styles.amountLabel}>Total</span>
                      <span className={styles.amountValue}>{formatCurrency(tx.total_amount)}</span>
                    </div>
                    <div>
                      <span className={styles.amountLabel}>Dibayar</span>
                      <span className={[styles.amountValue, tx.paid_amount < tx.total_amount ? styles.debt : ''].join(' ')}>{formatCurrency(tx.paid_amount)}</span>
                    </div>
                    {tx.paid_amount < tx.total_amount && (
                      <div>
                        <span className={styles.amountLabel}>Sisa Hutang</span>
                        <span className={[styles.amountValue, styles.debt].join(' ')}>{formatCurrency(tx.total_amount - tx.paid_amount)}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.txActions}>
                  <button className={styles.txActionBtn} onClick={() => setDetailTx(tx)}>Detail</button>
                  {tx.paid_amount < tx.total_amount && tx.status !== 'cancelled' && (
                    <button className={[styles.txActionBtn, styles.payBtn].join(' ')} onClick={() => { setPaymentTx(tx); setPaymentAmount(''); }}>+ Bayar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Transaction Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Transaksi Baru" size="lg"
        footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Batal</Button><Button onClick={handleCreate} loading={saving}>Simpan Transaksi</Button></>}
      >
        <div className={styles.createForm}>
          {saveError && <div className={styles.errorBanner}>{saveError}</div>}
          <Select label="Tipe Transaksi" value={txType} onChange={(e) => setTxType(e.target.value)} options={typeOptions} required />
          <Select label="Pelanggan (opsional)" value={customerId} onChange={(e) => setCustomerId(e.target.value)} options={customerOptions} placeholder="— Tanpa Pelanggan —" />
          {(txType === 'delivery' || txType === 'counter') && (
            <Select label="Lokasi Stok" value={locationId} onChange={(e) => setLocationId(e.target.value)} options={locationOptions} placeholder="Pilih lokasi..." />
          )}

          <div className={styles.cartSection}>
            <h3 className={styles.cartTitle}>Tambah Produk</h3>
            <div className={styles.addProductRow}>
              <Select label="Produk" value={addProductId} onChange={(e) => setAddProductId(e.target.value)} options={productOptions} placeholder="Pilih produk..." />
              <Input label="Qty" type="number" min="1" value={addQty} onChange={(e) => setAddQty(e.target.value)} />
              <div className={styles.addBtnWrap}>
                <Button variant="secondary" size="sm" onClick={addToCart} disabled={!addProductId}>Tambah</Button>
              </div>
            </div>
          </div>

          {cart.length > 0 && (
            <div className={styles.cartList}>
              <h3 className={styles.cartTitle}>Keranjang</h3>
              {cart.map((item) => (
                <div key={item.product_id} className={styles.cartItem}>
                  <span className={styles.cartProductName}>{item.product_name}</span>
                  <div className={styles.cartControls}>
                    <Input label="Qty" type="number" min="1" value={String(item.quantity)} onChange={(e) => updateCartQty(item.product_id, e.target.value)} />
                    <Input label="Harga (Rp)" type="number" min="0" value={String(item.unit_price)} onChange={(e) => updateCartPrice(item.product_id, e.target.value)} />
                    <button className={styles.removeBtn} onClick={() => removeFromCart(item.product_id)}>×</button>
                  </div>
                  <span className={styles.cartSubtotal}>{formatCurrency(item.quantity * item.unit_price)}</span>
                </div>
              ))}
              <div className={styles.cartTotal}>
                <span>Total</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
            </div>
          )}

          <Input label="Jumlah Dibayar (Rp)" type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} hint="Kosongkan atau isi 0 untuk bayar nanti (hutang)." />
        </div>
      </Modal>

      {/* Transaction Detail Modal */}
      {detailTx && (
        <Modal isOpen={!!detailTx} onClose={() => setDetailTx(null)} title="Detail Transaksi"
          footer={<Button variant="ghost" onClick={() => setDetailTx(null)}>Tutup</Button>}
        >
          <div className={styles.detailSection}>
            <div className={styles.detailRow}><span>Tipe</span><Badge variant={detailTx.type as 'delivery' | 'counter' | 'vendor_direct'}>{TRANSACTION_TYPE_LABELS[detailTx.type]}</Badge></div>
            <div className={styles.detailRow}><span>Status</span><Badge variant={detailTx.status as 'pending' | 'completed' | 'cancelled'}>{TRANSACTION_STATUS_LABELS[detailTx.status]}</Badge></div>
            {detailTx.customer_name && <div className={styles.detailRow}><span>Pelanggan</span><strong>{detailTx.customer_name}</strong></div>}
            {detailTx.location_name && <div className={styles.detailRow}><span>Lokasi</span><span>{detailTx.location_name}</span></div>}
            <div className={styles.detailRow}><span>Dibuat oleh</span><span>{detailTx.created_by_name}</span></div>
            <div className={styles.detailRow}><span>Waktu</span><span>{formatDate(detailTx.created_at)}</span></div>
          </div>
          <div className={styles.detailItems}>
            <h4 className={styles.detailSubtitle}>Item</h4>
            {detailTx.items.map((item, i) => (
              <div key={i} className={styles.detailItem}>
                <span>{item.product_name}</span>
                <span>{item.quantity} × {formatCurrency(item.unit_price)}</span>
                <strong>{formatCurrency(item.subtotal)}</strong>
              </div>
            ))}
            <div className={styles.detailTotal}><span>Total</span><strong>{formatCurrency(detailTx.total_amount)}</strong></div>
            <div className={styles.detailTotal}><span>Dibayar</span><span>{formatCurrency(detailTx.paid_amount)}</span></div>
            {detailTx.paid_amount < detailTx.total_amount && (
              <div className={[styles.detailTotal, styles.debtRow].join(' ')}><span>Sisa Hutang</span><strong>{formatCurrency(detailTx.total_amount - detailTx.paid_amount)}</strong></div>
            )}
          </div>
        </Modal>
      )}

      {/* Add Payment Modal */}
      <Modal isOpen={!!paymentTx} onClose={() => setPaymentTx(null)} title="Tambah Pembayaran" size="sm"
        footer={<><Button variant="ghost" onClick={() => setPaymentTx(null)} disabled={saving}>Batal</Button><Button onClick={handleAddPayment} loading={saving}>Bayar</Button></>}
      >
        {paymentTx && (
          <div className={styles.paymentForm}>
            <p className={styles.paymentDebt}>Sisa hutang: <strong>{formatCurrency(paymentTx.total_amount - paymentTx.paid_amount)}</strong></p>
            <Input label="Jumlah Bayar (Rp)" type="number" min="1" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} required autoFocus />
          </div>
        )}
      </Modal>
    </div>
  );
}
