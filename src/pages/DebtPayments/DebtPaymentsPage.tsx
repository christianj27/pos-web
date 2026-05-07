import { useState, useEffect, useCallback } from 'react';
import { debtService } from '../../services/debtService';
import { customerService } from '../../services/customerService';
import { Button, Modal, Input, Select, EmptyState, Spinner } from '../../components/common';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { useAuth } from '../../hooks/useAuth';
import type { DebtPayment, Customer } from '../../types';
import styles from './DebtPaymentsPage.module.scss';

export function DebtPaymentsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState({ customer_id: '', amount: '', notes: '' });

  const load = useCallback(async () => {
    const [pmts, custs] = await Promise.all([
      debtService.list().catch(() => []),
      customerService.list().catch(() => []),
    ]);
    setPayments(pmts as DebtPayment[]);
    setCustomers((custs as Customer[]).filter((c) => c.is_active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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
      setCreateOpen(false); load();
    } catch { setSaveError('Gagal menyimpan pembayaran hutang.'); }
    finally { setSaving(false); }
  }

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Pembayaran Hutang</h1>
          {(isOwner || user?.role === 'kasir') && (
            <Button onClick={openCreate} size="sm">+ Catat Pembayaran</Button>
          )}
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}
        {!loading && payments.length === 0 && <EmptyState message="Belum ada catatan pembayaran hutang." />}

        {!loading && payments.length > 0 && (
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
      </div>

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
