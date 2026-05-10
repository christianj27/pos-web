import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { debtService } from '../../services/debtService';
import { Button, Modal, Input, Select, Spinner } from '../../components/common';
import { customerService } from '../../services/customerService';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { TRANSACTION_TYPE_LABELS } from '../../utils/constants';
import { useAuth } from '../../hooks/useAuth';
import type { CustomerDebtHistory, Customer } from '../../types';
import styles from './CustomerDebtDetailPage.module.scss';

export function CustomerDebtDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = user?.role === 'owner' || user?.role === 'kasir';

  const [history, setHistory] = useState<CustomerDebtHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Create payment modal ──────────────────────────────────────────────────
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({ customer_id: customerId ?? '', amount: '', notes: '' });

  const load = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    try {
      const data = await debtService.getCustomerHistory(customerId);
      setHistory(data);
      setError(null);
    } catch {
      setError('Gagal memuat riwayat hutang pelanggan.');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    customerService.list()
      .then((custs) => setAllCustomers((custs as Customer[]).filter((c) => c.is_active)))
      .catch(() => {});
  }, []);

  function openCreate() {
    setForm({ customer_id: customerId ?? '', amount: '', notes: '' });
    setSaveError(null);
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!form.customer_id || !form.amount) { setSaveError('Pelanggan dan jumlah wajib diisi.'); return; }
    setSaving(true); setSaveError(null);
    try {
      await debtService.create({ customer_id: form.customer_id, amount: parseFloat(form.amount), notes: form.notes || undefined });
      setCreateOpen(false);
      load();
    } catch { setSaveError('Gagal menyimpan pembayaran hutang.'); }
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
              <h1 className={styles.title}>{history?.customer_name ?? 'Detail Hutang'}</h1>
              <p className={styles.subtitle}>Riwayat Hutang Pelanggan</p>
            </div>
          </div>
          {canCreate && (
            <Button onClick={openCreate} size="sm">+ Catat Pembayaran</Button>
          )}
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}
        {error && <div className={styles.errorBanner}>{error}</div>}

        {!loading && history && (
          <>
            {/* Outstanding debt banner */}
            <div className={[styles.debtBanner, history.outstanding_debt > 0 ? styles.debtBannerActive : styles.debtBannerClear].join(' ')}>
              <span className={styles.debtBannerLabel}>Total Hutang Aktif</span>
              <span className={styles.debtBannerAmount}>{formatCurrency(history.outstanding_debt)}</span>
            </div>

            {/* Debt-creating transactions */}
            <section>
              <h2 className={styles.sectionTitle}>Transaksi Pembuat Hutang</h2>
              {history.debt_transactions.length === 0 ? (
                <p className={styles.emptyText}>Tidak ada transaksi yang membuat hutang.</p>
              ) : (
                <div className={styles.cardList}>
                  {history.debt_transactions.map((tx) => (
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
                            }).format(new Date(tx.created_at))}
                          </span>
                          <span className={styles.txCardBy}>{tx.created_by_name}</span>
                        </div>
                        <div className={styles.txCardAmounts}>
                          <span className={styles.txCardTotal}>{formatCurrency(tx.total_amount)}</span>
                          <span className={styles.txCardPaid}>Dibayar: {formatCurrency(tx.paid_amount)}</span>
                          <span className={styles.txCardDebt}>Hutang: {formatCurrency(tx.debt_amount)}</span>
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
                          {p.notes && <span className={styles.payCardNotes}>{p.notes}</span>}
                          <span className={styles.payCardMeta}>{p.created_by_name} · {formatDate(p.created_at)}</span>
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
          {saveError && <div className={styles.errorBanner}>{saveError}</div>}
          <Select label="Pelanggan" value={form.customer_id} onChange={(e) => setForm(p => ({ ...p, customer_id: e.target.value }))} options={customerOptions} placeholder="Pilih pelanggan..." required />
          <Input label="Jumlah Bayar (Rp)" type="number" min="1" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} required />
          <Input label="Catatan (opsional)" value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
}
