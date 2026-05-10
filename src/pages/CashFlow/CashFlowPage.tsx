import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cashFlowService } from '../../services/cashFlowService';
import { Spinner } from '../../components/common/Spinner/Spinner';
import { formatCurrency } from '../../utils/formatCurrency';
import type { CashFlowEntry, CashFlowSummary } from '../../types';
import styles from './CashFlowPage.module.scss';

function getTodayWIB(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
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
  }).format(new Date(entry.created_at));

  const rowClass = [
    styles.row,
    entry.flow_type === 'cash_in'  ? styles.rowCashIn  : '',
    entry.flow_type === 'cash_out' ? styles.rowCashOut : '',
    entry.flow_type === 'new_debt' ? styles.rowNewDebt : '',
  ].join(' ');

  const amountClass = [
    styles.rowAmount,
    entry.flow_type === 'cash_in'  ? styles.amountIn  : '',
    entry.flow_type === 'cash_out' ? styles.amountOut : '',
    entry.flow_type === 'new_debt' ? styles.amountDebt : '',
  ].join(' ');

  const prefix = entry.flow_type === 'cash_in' ? '+' : entry.flow_type === 'cash_out' ? '−' : '';

  return (
    <div className={rowClass}>
      <div className={styles.rowLeft}>
        <div className={styles.rowBadge}>
          {FLOW_TYPE_LABELS[entry.flow_type] ?? entry.flow_type}
        </div>
        <span className={styles.rowDesc}>{entry.description}</span>
        <span className={styles.rowMeta}>{entry.created_by_name} · {time}</span>
      </div>
      <span className={amountClass}>
        {prefix}{formatCurrency(entry.amount)}
      </span>
    </div>
  );
}

export function CashFlowPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayWIB());

  const load = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const data = await cashFlowService.getSummary(date);
      setSummary(data);
      setError(null);
    } catch {
      setError('Gagal memuat data arus kas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(selectedDate); }, [load, selectedDate]);

  const isToday = selectedDate === getTodayWIB();

  function handleDateChange(date: string) {
    setSelectedDate(date);
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

        {error && <div className={styles.errorBanner}>{error}</div>}
        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {!loading && summary && (
          <>
            {/* Summary cards */}
            <div className={styles.summaryGrid}>
              <div className={[styles.summaryCard, styles.summaryIn].join(' ')}>
                <span className={styles.summaryLabel}>Kas Masuk</span>
                <span className={styles.summaryValue}>{formatCurrency(summary.total_cash_in)}</span>
              </div>
              <div className={[styles.summaryCard, styles.summaryOut].join(' ')}>
                <span className={styles.summaryLabel}>Kas Keluar</span>
                <span className={styles.summaryValue}>{formatCurrency(summary.total_cash_out)}</span>
              </div>
              <div className={[styles.summaryCard, summary.net_cash >= 0 ? styles.summaryNet : styles.summaryNetNeg].join(' ')}>
                <span className={styles.summaryLabel}>Net Kas</span>
                <span className={styles.summaryValue}>{formatCurrency(summary.net_cash)}</span>
              </div>
              <div className={[styles.summaryCard, styles.summaryDebt].join(' ')}>
                <span className={styles.summaryLabel}>Piutang Baru</span>
                <span className={styles.summaryValue}>{formatCurrency(summary.total_new_debt)}</span>
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
                  <CashFlowRow key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
