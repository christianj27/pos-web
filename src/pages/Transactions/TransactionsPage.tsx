import { useState, useEffect, useCallback, useMemo } from 'react';
import { transactionService } from '../../services/transactionService';
import { productService } from '../../services/productService';
import { customerService } from '../../services/customerService';
import { locationService } from '../../services/locationService';
import { Button, Badge, Modal, Input, Select, EmptyState, Spinner, ConfirmDialog } from '../../components/common';
import { TRANSACTION_TYPE_LABELS, TRANSACTION_STATUS_LABELS } from '../../utils/constants';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useAuth } from '../../hooks/useAuth';
import type { Transaction, Product, Customer, Location } from '../../types';
import styles from './TransactionsPage.module.scss';

type PaymentMethod = 'cash' | 'transfer' | 'qris';
interface CartItem { product_id: string; product_name: string; quantity: number; unit_price: number; }

const STATUS_TABS = [
  { value: 'all', label: 'Semua' },
  { value: 'completed', label: 'Selesai' },
  { value: 'cancelled', label: 'Dibatalkan' },
] as const;

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
};

export function TransactionsPage() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const isOwner = role === 'owner';
  const isKurir = role === 'kurir';
  const isKasir = role === 'kasir';

  // ── List state ───────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  const [paymentTx, setPaymentTx] = useState<Transaction | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [cancelTx, setCancelTx] = useState<Transaction | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Overlay (3-step) state ───────────────────────────────────────────────────
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const defaultType = isKurir ? 'delivery' : 'counter';
  const [txType, setTxType] = useState(defaultType);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [skipCustomer, setSkipCustomer] = useState(false);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState('');
  const [containerReturns, setContainerReturns] = useState<Record<string, string>>({});

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

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
      if (isOwner && typeFilter !== 'all' && tx.type !== typeFilter) return false;
      return true;
    });
  }, [transactions, statusFilter, typeFilter, isOwner]);

  // ── Overlay helpers ──────────────────────────────────────────────────────────
  function openOverlay() {
    setStep(1);
    setSelectedCustomer(null); setCustomerSearch('');
    setCart([]); setProductSearch('');
    setTxType(defaultType); setLocationId('');
    setPaymentMethod('cash'); setPaidAmount(''); setNotes('');
    setSaveError(null);
    setSkipCustomer(false); setDebtPaymentAmount(''); setContainerReturns({});
    // Auto-fill location for locked roles
    if (isKasir) {
      const wh = locations.find((l) => l.type === 'warehouse' && l.is_active);
      if (wh) setLocationId(wh.id);
    } else if (isKurir) {
      const truck = locations.find((l) => l.type === 'vehicle' && l.assigned_to === user?.id && l.is_active);
      if (truck) setLocationId(truck.id);
    }
    setOverlayOpen(true);
  }

  function closeOverlay() { setOverlayOpen(false); }

  function goBack() {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else closeOverlay();
  }

  function advanceToStep2() {
    setStep(2);
  }

  function handleSkipCustomer() {
    setSelectedCustomer(null);
    setSkipCustomer(true);
    setStep(2);
  }

  function advanceToStep3() {
    if (cart.length === 0) return;
    const t = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
    setPaidAmount(String(t));
    setStep(3);
  }

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  function incrementQty(prod: Product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === prod.id);
      if (existing) {
        return prev.map((c) => c.product_id === prod.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product_id: prod.id, product_name: prod.name, quantity: 1, unit_price: prod.base_price }];
    });
  }

  function decrementQty(productId: string) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === productId);
      if (!existing) return prev;
      if (existing.quantity <= 1) return prev.filter((c) => c.product_id !== productId);
      return prev.map((c) => c.product_id === productId ? { ...c, quantity: c.quantity - 1 } : c);
    });
  }

  function setQtyDirect(prod: Product, val: number) {
    if (val <= 0) {
      setCart((prev) => prev.filter((c) => c.product_id !== prod.id));
    } else {
      setCart((prev) => {
        const existing = prev.find((c) => c.product_id === prod.id);
        if (existing) {
          return prev.map((c) => c.product_id === prod.id ? { ...c, quantity: val } : c);
        }
        return [...prev, { product_id: prod.id, product_name: prod.name, quantity: val, unit_price: prod.base_price }];
      });
    }
  }

  function cartQty(productId: string): number {
    return cart.find((c) => c.product_id === productId)?.quantity ?? 0;
  }

  const total = cart.reduce((s, c) => s + c.quantity * c.unit_price, 0);
  const paid = parseFloat(paidAmount) || 0;
  const debt = Math.max(0, total - paid);

  // ── Submit ───────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (cart.length === 0) { setSaveError('Tambahkan minimal satu produk.'); return; }
    setSaving(true); setSaveError(null);
    const containerReturnsArr = Object.entries(containerReturns)
      .filter(([, qty]) => parseInt(qty) > 0)
      .map(([product_id, qty]) => ({ product_id, quantity: parseInt(qty) }));
    const debtAmt = parseFloat(debtPaymentAmount);
    try {
      await transactionService.create({
        type: txType,
        customer_id: selectedCustomer?.id,
        location_id: locationId || undefined,
        items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: c.unit_price })),
        paid_amount: paid,
        payment_method: paymentMethod,
        notes: notes.trim() || undefined,
        container_returns: containerReturnsArr.length > 0 ? containerReturnsArr : undefined,
        debt_payment_amount: debtAmt > 0 ? debtAmt : undefined,
      });
      closeOverlay();
      load();
    } catch {
      setSaveError('Gagal menyimpan transaksi.');
    } finally {
      setSaving(false);
    }
  }

  // ── Payment ──────────────────────────────────────────────────────────────────
  async function handleAddPayment() {
    if (!paymentTx || !paymentAmount) return;
    setSaving(true);
    try {
      await transactionService.addPayment(paymentTx.id, parseFloat(paymentAmount));
      setPaymentTx(null); setPaymentAmount(''); load();
    } finally { setSaving(false); }
  }

  // ── Cancel ───────────────────────────────────────────────────────────────────
  async function handleCancelConfirm() {
    if (!cancelTx) return;
    setCancelling(true);
    try {
      await transactionService.updateStatus(cancelTx.id, 'cancelled');
      setCancelTx(null); load();
    } finally { setCancelling(false); }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const typeOptions = [
    ...(isOwner || isKasir ? [{ value: 'counter', label: 'Kasir (Counter)' }] : []),
    ...(isOwner || isKurir ? [{ value: 'delivery', label: 'Pengiriman' }] : []),

  ];

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.phone ?? '').includes(customerSearch)
  );

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Transaksi</h1>
          <Button onClick={openOverlay} size="sm">+ Transaksi Baru</Button>
        </div>

        {/* Status filter tabs */}
        <div className={styles.tabsRow}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              className={[styles.tab, statusFilter === tab.value ? styles.tabActive : ''].join(' ')}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Owner type filter */}
        {isOwner && (
          <div className={styles.filterRow}>
            <Select
              label=""
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Semua Tipe' },
                { value: 'counter', label: 'Kasir (Counter)' },
                { value: 'delivery', label: 'Pengiriman' },
              ]}
            />
          </div>
        )}

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {!loading && filteredTxs.length === 0 && <EmptyState message="Belum ada transaksi." />}

        {!loading && filteredTxs.length > 0 && (
          <div className={styles.txList}>
            {filteredTxs.map((tx) => {
              const debtAmt = tx.total_amount - tx.paid_amount;
              return (
                <div key={tx.id} className={styles.txCard}>
                  <div className={styles.txTop}>
                    <div className={styles.txMeta}>
                      <Badge variant={tx.type as 'delivery' | 'counter'}>
                        {TRANSACTION_TYPE_LABELS[tx.type]}
                      </Badge>
                      <Badge variant={tx.status as 'pending' | 'completed' | 'cancelled'}>
                        {TRANSACTION_STATUS_LABELS[tx.status]}
                      </Badge>
                    </div>
                    <span className={styles.txDate}>{formatDate(tx.created_at)}</span>
                  </div>

                  <div className={styles.txBody}>
                    {tx.customer_name && <p className={styles.txCustomer}>{tx.customer_name}</p>}
                    {tx.location_name && <p className={styles.txLocation}>{tx.location_name}</p>}
                    {debtAmt > 0 && tx.status !== 'cancelled' && (
                      <p className={styles.debtBadge}>Ada utang: {formatCurrency(debtAmt)}</p>
                    )}
                    <div className={styles.txAmounts}>
                      <div>
                        <span className={styles.amountLabel}>Total</span>
                        <span className={styles.amountValue}>{formatCurrency(tx.total_amount)}</span>
                      </div>
                      <div>
                        <span className={styles.amountLabel}>Dibayar</span>
                        <span className={[styles.amountValue, debtAmt > 0 ? styles.debtAmt : ''].join(' ')}>
                          {formatCurrency(tx.paid_amount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.txActions}>
                    <button className={styles.txActionBtn} onClick={() => setDetailTx(tx)}>Detail</button>
                    {tx.paid_amount < tx.total_amount && tx.status !== 'cancelled' && (
                      <button
                        className={[styles.txActionBtn, styles.payBtn].join(' ')}
                        onClick={() => { setPaymentTx(tx); setPaymentAmount(''); }}
                      >
                        + Bayar
                      </button>
                    )}
                    {tx.status !== 'cancelled' && (
                      <button
                        className={[styles.txActionBtn, styles.cancelBtn].join(' ')}
                        onClick={() => setCancelTx(tx)}
                      >
                        Batalkan
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 3-Step Overlay ─────────────────────────────────────────────────────── */}
      {overlayOpen && (
        <div className={styles.overlay}>
          <div className={styles.overlayHeader}>
            <button className={styles.overlayBack} onClick={goBack} aria-label="Kembali">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className={styles.overlayTitle}>
              {step === 1 ? 'Pilih Pelanggan' : step === 2
                ? (selectedCustomer ? `Produk — ${selectedCustomer.name}` : 'Pilih Produk')
                : (selectedCustomer ? `Konfirmasi — ${selectedCustomer.name}` : 'Konfirmasi (Tanpa Pelanggan)')}
            </span>
            <div className={styles.steps}>
              {([1, 2, 3] as const).map((s, i) => (
                <div key={s} className={styles.stepGroup}>
                  {i > 0 && (
                    <div className={[styles.stepLine, step > s - 1 ? styles.stepLineDone : ''].join(' ')} />
                  )}
                  <div className={[
                    styles.stepDot,
                    step === s ? styles.stepActive : step > s ? styles.stepDone : '',
                  ].join(' ')}>
                    {step > s ? '✓' : s}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: Customer */}
          {step === 1 && (
            <>
              <div className={styles.overlayBody}>
                <div className={styles.searchWrap}>
                  <Input
                    label=""
                    placeholder="Cari nama atau nomor HP..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {filteredCustomers.length === 0 && <EmptyState message="Tidak ada pelanggan yang ditemukan." />}
                <ul className={styles.customerList}>
                  {filteredCustomers.map((c) => (
                    <li key={c.id}>
                      <button
                        className={[styles.customerRow, selectedCustomer?.id === c.id ? styles.customerRowSelected : ''].join(' ')}
                        onClick={() => setSelectedCustomer(c)}
                      >
                        <div className={styles.customerInfo}>
                          <span className={styles.customerName}>{c.name}</span>
                          {c.phone && <span className={styles.customerPhone}>{c.phone}</span>}
                          {(c.outstanding_debt ?? 0) > 0 && (
                            <span className={styles.customerDebt}>Hutang: {formatCurrency(c.outstanding_debt!)}</span>
                          )}
                        </div>
                        {selectedCustomer?.id === c.id && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" className={styles.checkIcon}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.overlayFooter}>
                <Button
                  onClick={advanceToStep2}
                  disabled={!selectedCustomer}
                  style={{ width: '100%' }}
                >
                  {selectedCustomer ? `Lanjut: ${selectedCustomer.name}` : 'Pilih pelanggan terlebih dahulu'}
                </Button>
                {(isKasir || isOwner) && (
                  <button
                    className={styles.skipCustomerBtn}
                    onClick={handleSkipCustomer}
                  >
                    Lewati (Tanpa Pelanggan)
                  </button>
                )}
              </div>
            </>
          )}

          {/* Step 2: Products */}
          {step === 2 && (
            <>
              <div className={styles.overlayBody}>
                <div className={styles.step2Controls}>
                  {isOwner ? (
                    <>
                      <Select
                        label="Tipe Transaksi"
                        value={txType}
                        onChange={(e) => setTxType(e.target.value)}
                        options={typeOptions}
                      />
                      <Select
                        label="Lokasi Stok"
                        value={locationId}
                        onChange={(e) => setLocationId(e.target.value)}
                        options={locations.map((l) => ({ value: l.id, label: l.name }))}
                        placeholder="Pilih lokasi..."
                      />
                    </>
                  ) : (
                    <div className={styles.lockedFields}>
                      <div className={styles.lockedField}>
                        <span className={styles.lockedLabel}>Tipe Transaksi</span>
                        <span className={styles.lockedValue}>{TRANSACTION_TYPE_LABELS[txType] ?? txType}</span>
                      </div>
                      <div className={styles.lockedField}>
                        <span className={styles.lockedLabel}>Lokasi Stok</span>
                        <span className={styles.lockedValue}>
                          {locations.find((l) => l.id === locationId)?.name ?? 'Belum ditentukan'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Refillable warning when no customer */}
                {skipCustomer && cart.some((c) => {
                  const prod = products.find((p) => p.id === c.product_id);
                  return prod?.category === 'refillable';
                }) && (
                  <div className={styles.warningBanner}>
                    Produk refillable dipilih tanpa pelanggan — pinjaman kontainer tidak akan dicatat.
                  </div>
                )}
                <div className={styles.searchWrap}>
                  <Input
                    label=""
                    placeholder="Cari produk..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                {filteredProducts.length === 0 && <EmptyState message="Tidak ada produk aktif." />}
                <ul className={styles.productList}>
                  {filteredProducts.map((prod) => {
                    const qty = cartQty(prod.id);
                    return (
                      <li key={prod.id} className={styles.productRow}>
                        <div className={styles.productInfo}>
                          <span className={styles.productName}>{prod.name}</span>
                          <span className={styles.productPrice}>{formatCurrency(prod.base_price)} / {prod.unit}</span>
                        </div>
                        <div className={styles.qtyControl}>
                          <button
                            className={styles.qtyBtn}
                            onClick={() => decrementQty(prod.id)}
                            disabled={qty === 0}
                            aria-label="Kurangi"
                          >−</button>
                          <input
                            type="number"
                            className={styles.qtyInput}
                            value={qty === 0 ? '' : qty}
                            min={0}
                            onChange={(e) => setQtyDirect(prod, parseInt(e.target.value) || 0)}
                            aria-label={`Jumlah ${prod.name}`}
                          />
                          <button
                            className={styles.qtyBtn}
                            onClick={() => incrementQty(prod)}
                            aria-label="Tambah"
                          >+</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className={styles.overlayFooter}>
                <div className={styles.footerTotal}>
                  <span>Total</span>
                  <strong>{formatCurrency(total)}</strong>
                </div>
                <Button
                  onClick={advanceToStep3}
                  disabled={cart.length === 0}
                  style={{ width: '100%' }}
                >
                  {cart.length === 0 ? 'Pilih minimal satu produk' : 'Lanjut ke Konfirmasi'}
                </Button>
              </div>
            </>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <>
              <div className={styles.overlayBody}>
                {saveError && <div className={styles.errorBanner}>{saveError}</div>}

                <div className={styles.summaryCard}>
                  <div className={styles.summaryRow}>
                    <span>Pelanggan</span>
                    <strong>{selectedCustomer?.name ?? 'Tanpa Pelanggan'}</strong>
                  </div>
                  <div className={styles.summaryRow}>
                    <span>Tipe</span>
                    <span>{TRANSACTION_TYPE_LABELS[txType as keyof typeof TRANSACTION_TYPE_LABELS] ?? txType}</span>
                  </div>
                  {cart.map((item) => (
                    <div key={item.product_id} className={styles.summaryRow}>
                      <span>{item.product_name} × {item.quantity}</span>
                      <span>{formatCurrency(item.quantity * item.unit_price)}</span>
                    </div>
                  ))}
                  <div className={[styles.summaryRow, styles.summaryTotal].join(' ')}>
                    <span>Total</span>
                    <strong>{formatCurrency(total)}</strong>
                  </div>
                </div>

                <div className={styles.payMethodSection}>
                  <p className={styles.payMethodLabel}>Metode Pembayaran</p>
                  <div className={styles.payMethodBtns}>
                    {(['cash', 'transfer', 'qris'] as PaymentMethod[]).map((m) => (
                      <button
                        key={m}
                        className={[styles.payMethodBtn, paymentMethod === m ? styles.payMethodActive : ''].join(' ')}
                        onClick={() => setPaymentMethod(m)}
                      >
                        {PAYMENT_LABELS[m]}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'qris' && (
                  <div className={styles.qrisBanner}>
                    Integrasi gateway QRIS akan hadir di Fase 2. Tandai pembayaran secara manual untuk saat ini.
                  </div>
                )}

                {/* Customer outstanding debt indicator */}
                {selectedCustomer && (selectedCustomer.outstanding_debt ?? 0) > 0 && (
                  <div className={styles.debtBox}>
                    <span>Total Hutang Pelanggan</span>
                    <strong>{formatCurrency(selectedCustomer.outstanding_debt!)}</strong>
                  </div>
                )}

                <Input
                  label="Jumlah Dibayar (Rp)"
                  type="number"
                  min="0"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                />

                {debt > 0 && (
                  <p className={styles.debtHint}>Sisa utang transaksi ini: <strong>{formatCurrency(debt)}</strong></p>
                )}

                {/* Old debt payment field */}
                {selectedCustomer && (selectedCustomer.outstanding_debt ?? 0) > 0 && (
                  <Input
                    label="Bayar Hutang Lama (Rp, opsional)"
                    type="number"
                    min="0"
                    value={debtPaymentAmount}
                    onChange={(e) => setDebtPaymentAmount(e.target.value)}
                  />
                )}

                {/* Container return section */}
                {selectedCustomer && cart.some((c) => products.find((p) => p.id === c.product_id)?.category === 'refillable') && (
                  <div className={styles.containerReturnSection}>
                    <p className={styles.containerReturnTitle}>Kembalian Kontainer (opsional)</p>
                    {cart
                      .filter((c) => products.find((p) => p.id === c.product_id)?.category === 'refillable')
                      .map((c) => (
                        <Input
                          key={c.product_id}
                          label={`Kontainer kosong dikembalikan — ${c.product_name}`}
                          type="number"
                          min="0"
                          value={containerReturns[c.product_id] ?? ''}
                          onChange={(e) => setContainerReturns((prev) => ({ ...prev, [c.product_id]: e.target.value }))}
                        />
                      ))}
                  </div>
                )}

                <div className={styles.notesWrap}>
                  <label className={styles.notesLabel}>Catatan (opsional)</label>
                  <textarea
                    className={styles.notesArea}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Tambahkan catatan..."
                  />
                </div>
              </div>
              <div className={styles.overlayFooter}>
                <Button onClick={handleCreate} loading={saving} style={{ width: '100%' }}>
                  Kirim Transaksi
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {detailTx && (
        <Modal
          isOpen={!!detailTx}
          onClose={() => setDetailTx(null)}
          title="Detail Transaksi"
          footer={<Button variant="ghost" onClick={() => setDetailTx(null)}>Tutup</Button>}
        >
          <div className={styles.detailSection}>
            <div className={styles.detailRow}><span>Tipe</span><Badge variant={detailTx.type as 'delivery' | 'counter'}>{TRANSACTION_TYPE_LABELS[detailTx.type]}</Badge></div>
            <div className={styles.detailRow}><span>Status</span><Badge variant={detailTx.status as 'pending' | 'completed' | 'cancelled'}>{TRANSACTION_STATUS_LABELS[detailTx.status]}</Badge></div>
            {detailTx.customer_name && <div className={styles.detailRow}><span>Pelanggan</span><strong>{detailTx.customer_name}</strong></div>}
            {detailTx.location_name && <div className={styles.detailRow}><span>Lokasi</span><span>{detailTx.location_name}</span></div>}
            {detailTx.payment_method && <div className={styles.detailRow}><span>Pembayaran</span><span>{PAYMENT_LABELS[detailTx.payment_method]}</span></div>}
            {detailTx.notes && <div className={styles.detailRow}><span>Catatan</span><span>{detailTx.notes}</span></div>}
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
              <div className={[styles.detailTotal, styles.debtRow].join(' ')}>
                <span>Sisa Hutang</span><strong>{formatCurrency(detailTx.total_amount - detailTx.paid_amount)}</strong>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Add Payment Modal */}
      <Modal
        isOpen={!!paymentTx}
        onClose={() => setPaymentTx(null)}
        title="Tambah Pembayaran"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPaymentTx(null)} disabled={saving}>Batal</Button>
            <Button onClick={handleAddPayment} loading={saving}>Bayar</Button>
          </>
        }
      >
        {paymentTx && (
          <div className={styles.paymentForm}>
            <p className={styles.paymentDebt}>
              Sisa hutang: <strong>{formatCurrency(paymentTx.total_amount - paymentTx.paid_amount)}</strong>
            </p>
            <Input
              label="Jumlah Bayar (Rp)"
              type="number"
              min="1"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
              autoFocus
            />
          </div>
        )}
      </Modal>

      {/* Cancel Confirm */}
      <ConfirmDialog
        isOpen={!!cancelTx}
        onClose={() => setCancelTx(null)}
        onConfirm={handleCancelConfirm}
        title="Batalkan Transaksi"
        message="Batalkan transaksi ini? Stok akan dikembalikan secara otomatis."
        confirmText="Ya, Batalkan"
        loading={cancelling}
      />
    </div>
  );
}
