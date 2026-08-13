import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cashFlowService } from '../../services/cashFlowService';
import { exportCashFlowToXlsx } from '../../utils/cashFlowExport';
import { Spinner } from '../../components/common/Spinner/Spinner';
import { formatCurrency } from '../../utils/formatCurrency';
import { getErrorMessage } from '../../utils/apiError';
import { useToast } from '../../context/ToastContext';
import type { CashFlowEntry, CashFlowSummary } from '../../types';
import styles from './CashFlowPage.module.scss';

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

function CashFlowRow({ entry }: { entry: CashFlowEntry }) {
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
          {FLOW_TYPE_LABELS[entry.flowType] ?? entry.flowType}
        </div>
        <span className={styles.rowDesc}>{entry.description}</span>
        <span className={styles.rowMeta}>{entry.createdByName} · {time}</span>
      </div>
      <span className={amountClass}>
        {prefix}{formatCurrency(entry.amount)}
      </span>
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

  const load = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const data = await cashFlowService.getSummary(date);
      setSummary(data);
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
                {summary.entries.map((entry) => (
                  <CashFlowRow key={entry.index} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
