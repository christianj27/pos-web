import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { debtService } from '../../services/debtService';
import { Button, Modal, Input, Select, Spinner } from '../../components/common';
import { customerService } from '../../services/customerService';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { TRANSACTION_TYPE_LABELS } from '../../utils/constants';
import { useAuth } from '../../hooks/useAuth';
import { getErrorMessage } from '../../utils/apiError';
import type { CustomerDebtHistory, Customer } from '../../types';
import styles from './CustomerDebtDetailPage.module.scss';

export function CustomerDebtDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.role === 'owner' || user?.role === 'kasir';
  const { showToast } = useToast();

  const [history, setHistory] = useState<CustomerDebtHistory | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Create payment modal ──────────────────────────────────────────────────
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_id: customerId ?? '', amount: '', notes: '', method: 'cash' as 'cash' | 'transfer' | 'qris' });

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const data = await debtService.getCustomerHistory(customerId);
      setHistory(data);
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memuat riwayat hutang pelanggan.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [customerId, showToast]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  useEffect(() => {
    customerService.list()
      .then((custs) => setAllCustomers((custs as Customer[]).filter((c) => c.isActive)))
      .catch((err) => { showToast(getErrorMessage(err, 'Gagal memuat daftar pelanggan.'), 'error'); });
  }, [showToast]);

  function openCreate() {
    setForm({ customer_id: customerId ?? '', amount: '', notes: '', method: 'cash' });
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!form.customer_id || !form.amount) { showToast('Pelanggan dan jumlah wajib diisi.', 'error'); return; }
    setSaving(true);
    try {
      await debtService.create({ customerId: form.customer_id, amount: parseFloat(form.amount), method: form.method, note: form.notes || undefined });
      setCreateOpen(false);
      showToast('Pembayaran berhasil dicatat.');
      load();
    } catch (err) { showToast(getErrorMessage(err, 'Gagal menyimpan pembayaran hutang.'), 'error'); }
    finally { setSaving(false); }
  }

  const customerOptions = allCustomers.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <button className={styles.backArrow} onClick={() => navigate('/debt-payments')} aria-label="Kembali">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className={styles.title}>{history?.customerName ?? 'Detail Hutang'}</h1>
              <p className={styles.subtitle}>Riwayat Hutang Pelanggan</p>
            </div>
          </div>
          {canCreate && (
            <Button onClick={openCreate} size="sm">+ Catat Pembayaran</Button>
          )}
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {!loading && history && (
          <>
            {/* Outstanding debt banner */}
            <div className={[styles.debtBanner, history.outstandingDebt > 0 ? styles.debtBannerActive : styles.debtBannerClear].join(' ')}>
              <span className={styles.debtBannerLabel}>Total Hutang Aktif</span>
              <span className={styles.debtBannerAmount}>{formatCurrency(history.outstandingDebt)}</span>
            </div>

            {/* Initial debt info row */}
            {history.initialDebt > 0 && (
              <div className={styles.initialDebtRow}>
                <span className={styles.initialDebtLabel}>Saldo Awal Hutang</span>
                <span className={styles.initialDebtAmount}>{formatCurrency(history.initialDebt)}</span>
              </div>
            )}

            {/* Debt-creating transactions */}
            <section>
              <h2 className={styles.sectionTitle}>Transaksi Pembuat Hutang</h2>
              {history.debtTransactions.length === 0 ? (
                <p className={styles.emptyText}>Tidak ada transaksi yang membuat hutang.</p>
              ) : (
                <div className={styles.cardList}>
                  {history.debtTransactions.map((tx) => (
                    <div key={tx.id} className={styles.txCard}>
                      <div className={styles.txCardTop}>
                        <div className={styles.txCardInfo}>
                          <span className={styles.txCardType}>
                            {TRANSACTION_TYPE_LABELS[tx.type] ?? tx.type}
                          </span>
                          <span className={styles.txCardDate}>
                            {new Intl.DateTimeFormat('id-ID', {
                              day: 'numeric', month: 'short', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                              timeZone: 'Asia/Jakarta',
                            }).format(new Date(tx.createdAt))}
                          </span>
                          <span className={styles.txCardBy}>{tx.createdByName}</span>
                        </div>
                        <div className={styles.txCardAmounts}>
                          <span className={styles.txCardTotal}>{formatCurrency(tx.totalAmount)}</span>
                          <span className={styles.txCardPaid}>Dibayar: {formatCurrency(tx.paidAmount)}</span>
                          <span className={styles.txCardDebt}>Hutang: {formatCurrency(tx.debtAmount)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Standalone payments */}
            <section>
              <h2 className={styles.sectionTitle}>Pembayaran Hutang</h2>
              {history.payments.length === 0 ? (
                <p className={styles.emptyText}>Belum ada pembayaran hutang tercatat.</p>
              ) : (
                <div className={styles.cardList}>
                  {history.payments.map((p) => (
                    <div key={p.id} className={styles.payCard}>
                      <div className={styles.payCardTop}>
                        <div className={styles.payCardInfo}>
                          {p.note && <span className={styles.payCardNotes}>{p.note}</span>}
                          <span className={styles.payCardMeta}>{p.createdByName} · {formatDate(p.createdAt)}</span>
                        </div>
                        <span className={styles.payCardAmount}>{formatCurrency(p.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Create Payment Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Catat Pembayaran Hutang" size="sm"
        footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={saving}>Batal</Button><Button onClick={handleCreate} loading={saving}>Simpan</Button></>}
      >
        <div className={styles.createForm}>
          <Select label="Pelanggan" value={form.customer_id} onChange={(e) => setForm(p => ({ ...p, customer_id: e.target.value }))} options={customerOptions} placeholder="Pilih pelanggan..." required />
          <Input label="Jumlah Bayar (Rp)" currency min="1" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} required />
          <Select label="Metode Pembayaran" value={form.method} onChange={(e) => setForm(p => ({ ...p, method: e.target.value as 'cash' | 'transfer' | 'qris' }))} options={[{ value: 'cash', label: 'Tunai' }, { value: 'transfer', label: 'Transfer' }, { value: 'qris', label: 'QRIS' }]} required />
          <Input label="Catatan (opsional)" value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
