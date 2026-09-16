import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cashFlowService } from '../../services/cashFlowService';
import { expenseService } from '../../services/expenseService';
import { exportCashFlowToXlsx } from '../../utils/cashFlowExport';
import { EXPENSE_CATEGORY_OPTIONS } from '../../utils/expenseLabels';
import { Button, Input, Select, Modal, ConfirmDialog } from '../../components/common';
import { Spinner } from '../../components/common/Spinner/Spinner';
import { formatCurrency } from '../../utils/formatCurrency';
import { getErrorMessage } from '../../utils/apiError';
import { useToast } from '../../context/ToastContext';
import type { CashFlowEntry, CashFlowSummary, Expense, ExpenseCategory, ExpensePayload } from '../../types';
import styles from './CashFlowPage.module.scss';

interface ExpenseFormState {
  category: ExpenseCategory;
  description: string;
  amount: string;
  expenseDate: string;
}

function newExpenseForm(expenseDate: string): ExpenseFormState {
  return { category: 'fuel', description: '', amount: '', expenseDate };
}

function getTodayWIB(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function getCurrentMonthWIB(): string {
  return getTodayWIB().slice(0, 7); // YYYY-MM
}

function getMonthBounds(month: string): { startDate: string; endDate: string } {
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

const FLOW_TYPE_LABELS: Record<string, string> = {
  cash_in:  'Kas Masuk',
  cash_out: 'Kas Keluar',
  new_debt: 'Piutang',
};

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

function CashFlowRow({ entry, onEdit, onDelete }: {
  entry: CashFlowEntry;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const time = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(entry.createdAt));

  const rowClass = [
    styles.row,
    entry.flowType === 'cash_in'  ? styles.rowCashIn  : '',
    entry.flowType === 'cash_out' ? styles.rowCashOut : '',
    entry.flowType === 'new_debt' ? styles.rowNewDebt : '',
  ].join(' ');

  const amountClass = [
    styles.rowAmount,
    entry.flowType === 'cash_in'  ? styles.amountIn  : '',
    entry.flowType === 'cash_out' ? styles.amountOut : '',
    entry.flowType === 'new_debt' ? styles.amountDebt : '',
  ].join(' ');

  const prefix = entry.flowType === 'cash_in' ? '+' : entry.flowType === 'cash_out' ? '−' : '';

  return (
    <div className={rowClass}>
      <div className={styles.rowLeft}>
        <div className={styles.rowBadge}>
          {entry.category === 'operational_expense'
            ? 'Pengeluaran'
            : FLOW_TYPE_LABELS[entry.flowType] ?? entry.flowType}
        </div>
        <span className={styles.rowDesc}>{entry.description}</span>
        <span className={styles.rowMeta}>{entry.createdByName} · {time}</span>
      </div>
      <div className={styles.rowRight}>
        <span className={amountClass}>
          {prefix}{formatCurrency(entry.amount)}
        </span>
        {(onEdit || onDelete) && (
          <div className={styles.rowActions}>
            {onEdit && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={onEdit}
                aria-label={`Ubah pengeluaran ${entry.description}`}
                title="Ubah"
              >
                <PencilIcon />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className={[styles.iconBtn, styles.iconBtnDanger].join(' ')}
                onClick={onDelete}
                aria-label={`Hapus pengeluaran ${entry.description}`}
                title="Hapus"
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CashFlowPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayWIB());
  const [exportMonth, setExportMonth] = useState<string>(getCurrentMonthWIB());
  const [exportLoading, setExportLoading] = useState(false);

  // Operational expenses (FR-CSH-006)
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(newExpenseForm(getTodayWIB()));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const [summaryData, expenseData] = await Promise.all([
        cashFlowService.getSummary(date),
        expenseService.list(date),
      ]);
      setSummary(summaryData);
      setExpenses(expenseData);
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memuat data arus kas.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { void Promise.resolve().then(() => load(selectedDate)); }, [load, selectedDate]);

  const isToday = selectedDate === getTodayWIB();

  function handleDateChange(date: string) {
    setSelectedDate(date);
  }

  // ── Operational expenses (FR-CSH-006) ─────────────────────────────────────

  function openCreateExpense() {
    setEditingExpenseId(null);
    setForm(newExpenseForm(selectedDate));
    setFormError(null);
    setExpenseModalOpen(true);
  }

  function openEditExpense(expense: Expense) {
    setEditingExpenseId(expense.id);
    setForm({
      category: expense.category,
      description: expense.description,
      amount: String(Math.round(expense.amount)),
      expenseDate: expense.expenseDate,
    });
    setFormError(null);
    setExpenseModalOpen(true);
  }

  async function handleSaveExpense() {
    const description = form.description.trim();
    const amount = Number(form.amount);

    if (!description) { setFormError('Deskripsi pengeluaran wajib diisi.'); return; }
    if (!form.amount || Number.isNaN(amount) || amount <= 0) {
      setFormError('Jumlah pengeluaran harus berupa angka positif.');
      return;
    }
    if (!form.expenseDate) { setFormError('Tanggal pengeluaran wajib diisi.'); return; }
    if (form.expenseDate > getTodayWIB()) {
      setFormError('Tanggal pengeluaran tidak boleh di masa depan.');
      return;
    }

    const payload: ExpensePayload = {
      category: form.category,
      description,
      amount,
      expenseDate: form.expenseDate,
    };

    setSaving(true);
    try {
      if (editingExpenseId) {
        await expenseService.update(editingExpenseId, payload);
        showToast('Pengeluaran berhasil diperbarui.', 'success');
      } else {
        await expenseService.create(payload);
        showToast('Pengeluaran berhasil dicatat.', 'success');
      }
      setExpenseModalOpen(false);
      // Follow the expense to its business date so the new row stays visible.
      if (payload.expenseDate !== selectedDate) setSelectedDate(payload.expenseDate);
      else await load(selectedDate);
    } catch (err) {
      showToast(getErrorMessage(err, 'Terjadi kesalahan. Silakan coba lagi.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExpense() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await expenseService.remove(deleteTarget.id);
      showToast('Pengeluaran berhasil dihapus.', 'success');
      setDeleteTarget(null);
      await load(selectedDate);
    } catch (err) {
      showToast(getErrorMessage(err, 'Terjadi kesalahan. Silakan coba lagi.'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    setExportLoading(true);
    try {
      const { startDate, endDate } = getMonthBounds(exportMonth);
      const data = await cashFlowService.getRange(startDate, endDate);
      exportCashFlowToXlsx(data, exportMonth);
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal mengunduh laporan.'), 'error');
    } finally {
      setExportLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <button className={styles.backArrow} onClick={() => navigate('/lainnya')} aria-label="Kembali ke Lainnya">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className={styles.title}>Arus Kas</h1>
          </div>
          <Button size="sm" className={styles.headerAction} onClick={openCreateExpense}>
            + Catat Pengeluaran
          </Button>
        </div>

        {/* Monthly export */}
        <div className={styles.exportRow}>
          <span className={styles.exportLabel}>Unduh Laporan Bulanan</span>
          <div className={styles.exportControls}>
            <input
              type="month"
              className={styles.monthInput}
              value={exportMonth}
              max={getCurrentMonthWIB()}
              onChange={(e) => { if (e.target.value) setExportMonth(e.target.value); }}
            />
            <button
              className={styles.exportBtn}
              onClick={handleExport}
              disabled={exportLoading}
              aria-label="Unduh laporan arus kas bulanan sebagai Excel"
            >
              {exportLoading ? (
                <Spinner size="sm" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4" />
                </svg>
              )}
              {exportLoading ? 'Memproses...' : 'Unduh .xlsx'}
            </button>
          </div>
        </div>

        {/* Date filter */}
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

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {!loading && summary && (
          <>
            {/* Summary cards */}
            <div className={styles.summaryGrid}>
              <div className={[styles.summaryCard, styles.summaryIn].join(' ')}>
                <span className={styles.summaryLabel}>Kas Masuk</span>
                <span className={styles.summaryValue}>{formatCurrency(summary.totalCashIn)}</span>
              </div>
              <div className={[styles.summaryCard, styles.summaryOut].join(' ')}>
                <span className={styles.summaryLabel}>Kas Keluar</span>
                <span className={styles.summaryValue}>{formatCurrency(summary.totalCashOut)}</span>
              </div>
              <div className={[styles.summaryCard, summary.netCash >= 0 ? styles.summaryNet : styles.summaryNetNeg].join(' ')}>
                <span className={styles.summaryLabel}>Net Kas</span>
                <span className={styles.summaryValue}>{formatCurrency(summary.netCash)}</span>
              </div>
              <div className={[styles.summaryCard, styles.summaryDebt].join(' ')}>
                <span className={styles.summaryLabel}>Piutang Baru</span>
                <span className={styles.summaryValue}>{formatCurrency(summary.totalNewDebt)}</span>
              </div>
            </div>

            {/* Legend */}
            <div className={styles.legend}>
              <span className={[styles.legendDot, styles.dotIn].join(' ')} />
              <span className={styles.legendLabel}>Kas Masuk</span>
              <span className={[styles.legendDot, styles.dotOut].join(' ')} />
              <span className={styles.legendLabel}>Kas Keluar</span>
              <span className={[styles.legendDot, styles.dotDebt].join(' ')} />
              <span className={styles.legendLabel}>Piutang</span>
            </div>

            {/* Entry list */}
            {summary.entries.length === 0 ? (
              <div className={styles.emptyWrap}>
                <p className={styles.emptyText}>Tidak ada aktivitas arus kas pada tanggal ini.</p>
              </div>
            ) : (
              <div className={styles.entryList}>
                {summary.entries.map((entry) => {
                  const expense = entry.category === 'operational_expense'
                    ? expenses.find((e) => e.id === entry.referenceId)
                    : undefined;
                  return (
                    <CashFlowRow
                      key={entry.index}
                      entry={entry}
                      onEdit={expense ? () => openEditExpense(expense) : undefined}
                      onDelete={expense ? () => setDeleteTarget(expense) : undefined}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create / edit operational expense */}
      <Modal
        isOpen={expenseModalOpen}
        onClose={() => { if (!saving) setExpenseModalOpen(false); }}
        title={editingExpenseId ? 'Ubah Pengeluaran' : 'Catat Pengeluaran'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setExpenseModalOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSaveExpense} loading={saving}>Simpan</Button>
          </>
        }
      >
        <div className={styles.formFields}>
          <Select
            label="Kategori"
            options={EXPENSE_CATEGORY_OPTIONS}
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as ExpenseCategory }))}
            required
          />
          <Input
            label="Deskripsi"
            placeholder="cth. Isi bensin truk Andi"
            maxLength={255}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            required
          />
          <Input
            label="Jumlah (Rp)"
            currency
            min="1"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            required
          />
          <Input
            label="Tanggal"
            type="date"
            max={getTodayWIB()}
            value={form.expenseDate}
            onChange={(e) => setForm((p) => ({ ...p, expenseDate: e.target.value }))}
            required
          />
          {formError && <p className={styles.formError}>{formError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteExpense}
        title="Hapus Pengeluaran"
        message={deleteTarget
          ? `Hapus pengeluaran "${deleteTarget.description}" sebesar ${formatCurrency(deleteTarget.amount)}?`
          : ''}
        confirmText="Hapus"
        loading={deleting}
      />
    </div>
  );
}
