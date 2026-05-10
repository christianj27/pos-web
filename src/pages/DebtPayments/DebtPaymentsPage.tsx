import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { debtService } from '../../services/debtService';
import { customerService } from '../../services/customerService';
import { Button, Modal, Input, Select, EmptyState, Spinner } from '../../components/common';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useAuth } from '../../hooks/useAuth';
import type { DebtPayment, Customer } from '../../types';
import styles from './DebtPaymentsPage.module.scss';

type Tab = 'outstanding' | 'history';

function getTodayWIB(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

export function DebtPaymentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOwner = user?.role === 'owner';
  const canCreate = isOwner || user?.role === 'kasir';

  const [activeTab, setActiveTab] = useState<Tab>('outstanding');

  // ── Outstanding tab state ─────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);

  // ── History tab state ─────────────────────────────────────────────────────
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayWIB());

  // ── Create modal state ────────────────────────────────────────────────────
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({ customer_id: '', amount: '', notes: '' });

  // ── Load outstanding customers ────────────────────────────────────────────
  const loadOutstanding = useCallback(async () => {
    setCustomersLoading(true);
    const custs = await customerService.list().catch(() => [] as Customer[]);
    const active = (custs as Customer[]).filter((c) => c.is_active);
    setAllCustomers(active);
    const withDebt = active
      .filter((c) => (c.outstanding_debt ?? 0) > 0)
      .sort((a, b) => (b.outstanding_debt ?? 0) - (a.outstanding_debt ?? 0));
    setCustomers(withDebt);
    setCustomersLoading(false);
  }, []);

  // ── Load history ──────────────────────────────────────────────────────────
  const loadHistory = useCallback(async (date: string) => {
    setHistoryLoading(true);
    const pmts = await debtService.list(date).catch(() => [] as DebtPayment[]);
    setPayments(pmts as DebtPayment[]);
    setHistoryLoading(false);
    setHistoryLoaded(true);
  }, []);

  useEffect(() => { loadOutstanding(); }, [loadOutstanding]);

  useEffect(() => {
    if (activeTab === 'history' && !historyLoaded) {
      loadHistory(selectedDate);
    }
  }, [activeTab, historyLoaded, loadHistory, selectedDate]);

  const isToday = selectedDate === getTodayWIB();

  function handleDateChange(date: string) {
    setSelectedDate(date);
    loadHistory(date);
  }

  function openCreate() {
    setForm({ customer_id: '', amount: '', notes: '' });
    setSaveError(null);
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!form.customer_id || !form.amount) { setSaveError('Pelanggan dan jumlah wajib diisi.'); return; }
    setSaving(true); setSaveError(null);
    try {
      await debtService.create({ customer_id: form.customer_id, amount: parseFloat(form.amount), notes: form.notes || undefined });
      setCreateOpen(false);
      // Refresh both tabs
      loadOutstanding();
      if (historyLoaded) { setHistoryLoaded(false); loadHistory(selectedDate); }
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
            {isOwner && (
              <button className={styles.backArrow} onClick={() => navigate('/lainnya')} aria-label="Kembali ke Lainnya">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <h1 className={styles.title}>Pembayaran Hutang</h1>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabBar}>
          <button
            className={[styles.tabBtn, activeTab === 'outstanding' ? styles.tabActive : ''].join(' ')}
            onClick={() => setActiveTab('outstanding')}
          >
            Hutang Aktif
          </button>
          <button
            className={[styles.tabBtn, activeTab === 'history' ? styles.tabActive : ''].join(' ')}
            onClick={() => setActiveTab('history')}
          >
            Riwayat
          </button>
        </div>

        {/* ── Tab: Outstanding ── */}
        {activeTab === 'outstanding' && (
          <>
            {/* Tab-level action button */}
            {canCreate && (
              <div className={styles.tabAction}>
                <Button onClick={openCreate} size="sm">+ Catat Pembayaran</Button>
              </div>
            )}

            {customersLoading && <div className={styles.loadingWrap}><Spinner /></div>}
            {!customersLoading && customers.length === 0 && (
              <EmptyState message="Tidak ada pelanggan dengan hutang aktif." />
            )}
            {!customersLoading && customers.length > 0 && (
              <div className={styles.outstandingList}>
                {customers.map((c) => (
                  <button
                    key={c.id}
                    className={styles.outstandingRow}
                    onClick={() => navigate(`/debt-payments/${c.id}`)}
                  >
                    <div className={styles.outstandingInfo}>
                      <span className={styles.outstandingName}>{c.name}</span>
                      {c.phone && <span className={styles.outstandingSub}>{c.phone}</span>}
                    </div>
                    <div className={styles.outstandingRight}>
                      <span className={styles.outstandingDebt}>{formatCurrency(c.outstanding_debt ?? 0)}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className={styles.outstandingChevron}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Tab: History ── */}
        {activeTab === 'history' && (
          <>
            <div className={styles.filterRow}>
              <input
                type="date"
                className={styles.dateInput}
                value={selectedDate}
                max={getTodayWIB()}
                onChange={(e) => { if (e.target.value) handleDateChange(e.target.value); }}
              />
              {!isToday && (
                <button className={styles.todayBtn} onClick={() => handleDateChange(getTodayWIB())}>
                  Hari Ini
                </button>
              )}
            </div>

            {historyLoading && <div className={styles.loadingWrap}><Spinner /></div>}
            {!historyLoading && payments.length === 0 && (
              <EmptyState message="Belum ada catatan pembayaran hutang pada tanggal ini." />
            )}
            {!historyLoading && payments.length > 0 && (
              <div className={styles.cardList}>
                {payments.map((p) => (
                  <div key={p.id} className={styles.card}>
                    <div className={styles.cardTop}>
                      <div className={styles.cardInfo}>
                        <span className={styles.cardName}>{p.customer_name}</span>
                        {p.notes && <span className={styles.cardSub}>{p.notes}</span>}
                      </div>
                      <span className={styles.cardAmount}>{formatCurrency(p.amount)}</span>
                    </div>
                    <div className={styles.cardMeta}>{p.created_by_name} · {formatDate(p.created_at)}</div>
                  </div>
                ))}
              </div>
            )}
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


