import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { customerService } from '../../services/customerService';
import { Modal, Button, Spinner } from '../../components/common';
import { STOCK_PERIOD_OPTIONS, formatStockPeriodCaption, resolveStockPeriodRange, todayWIB } from '../../utils/stockPeriod';
import type { Customer, CustomerStockProductItem, CustomerStockSummaryResponse, StockPeriod } from '../../types';
import styles from './CustomerStockMovementModal.module.scss';

/**
 * FR-CST-011 — per-customer "Pergerakan Stok" modal, mirroring the Dashboard section (FR-DSH-012)
 * but scoped to one customer: the period presets (Harian / Mingguan / Bulanan / Tahunan / Kustom) are
 * anchored by a date picker inside the modal, and each product row expands in place to a per-staff
 * Terjual / Dikembalikan breakdown.
 */
export function CustomerStockMovementModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const today = todayWIB();

  const [period, setPeriod] = useState<StockPeriod>('day');
  const [anchorDate, setAnchorDate] = useState<string>(today);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [summary, setSummary] = useState<CustomerStockSummaryResponse | null>(null);
  const [error, setError] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const range = resolveStockPeriodRange(period, anchorDate, customStart, customEnd);

  const fetchSummary = useCallback(async () => {
    if (!range.valid) return;
    setError(false);
    try {
      const data = await customerService.getStockSummary(customer.id, {
        period,
        date: anchorDate,
        startDate: customStart,
        endDate: customEnd,
      });
      setSummary(data);
    } catch {
      // The last successful payload stays in state but only renders while it matches the current range.
      setError(true);
    }
  }, [range.valid, period, anchorDate, customStart, customEnd, customer.id]);

  useEffect(() => {
    void Promise.resolve().then(fetchSummary);
  }, [fetchSummary]);

  function handlePeriodChange(next: StockPeriod) {
    setPeriod(next);
    // The expanded breakdown belongs to the previous period.
    setExpandedProductId(null);
    if (next === 'custom' && (!customStart || !customEnd)) {
      // Seed the custom inputs from the range in effect; the end is clamped to today because a future
      // bound is rejected by the custom-range rule (Bulanan/Tahunan legitimately run past today).
      const cap = (day: string) => (day > today ? today : day);
      setCustomStart(cap(range.startDate));
      setCustomEnd(cap(range.endDate));
    }
  }

  // A payload only renders while it belongs to the range currently selected, so switching the period
  // never shows the previous range's rows under the new caption (and no state is cleared in an effect).
  const summaryForRange =
    summary &&
    summary.period === range.period &&
    summary.startDate === range.startDate &&
    summary.endDate === range.endDate
      ? summary
      : null;

  const emptyText = period === 'day'
    ? 'Tidak ada pergerakan stok pada tanggal ini.'
    : 'Tidak ada pergerakan stok pada periode ini.';

  let body: ReactNode;
  if (!range.valid) {
    // Incomplete custom range — the caption area carries the validation message instead.
    body = null;
  } else if (!summaryForRange) {
    body = error
      ? <p className={styles.emptyText}>Gagal memuat pergerakan stok.</p>
      : <div className={styles.loading}><Spinner size="sm" /></div>;
  } else if (summaryForRange.items.length > 0) {
    body = (
      <div className={styles.list}>
        {summaryForRange.items.map((item) => (
          <ProductRow
            key={item.productId}
            item={item}
            expanded={expandedProductId === item.productId}
            onToggle={() => setExpandedProductId((prev) => (prev === item.productId ? null : item.productId))}
          />
        ))}
      </div>
    );
  } else {
    body = <p className={styles.emptyText}>{emptyText}</p>;
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Pergerakan Stok — ${customer.name}`}
      size="lg"
      footer={<Button variant="ghost" onClick={onClose}>Tutup</Button>}
    >
      <div className={styles.anchorRow}>
        <label className={styles.anchorLabel} htmlFor="customer-stock-date">Tanggal</label>
        <input
          id="customer-stock-date"
          type="date"
          className={styles.dateInput}
          value={anchorDate}
          max={today}
          onChange={(e) => setAnchorDate(e.target.value)}
        />
      </div>

      <div className={styles.periodTabs} role="group" aria-label="Periode pergerakan stok">
        {STOCK_PERIOD_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={[styles.periodTab, period === option.value ? styles.periodTabActive : ''].join(' ')}
            aria-pressed={period === option.value}
            onClick={() => handlePeriodChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className={styles.customRow}>
          <input
            type="date"
            className={styles.dateInput}
            value={customStart}
            max={today}
            aria-label="Tanggal mulai"
            onChange={(e) => setCustomStart(e.target.value)}
          />
          <span className={styles.customSep}>{'\u2013'}</span>
          <input
            type="date"
            className={styles.dateInput}
            value={customEnd}
            max={today}
            aria-label="Tanggal selesai"
            onChange={(e) => setCustomEnd(e.target.value)}
          />
        </div>
      )}

      {range.valid
        ? <p className={styles.caption}>{formatStockPeriodCaption(range)}</p>
        : <p className={styles.error}>{range.error}</p>}

      {body}
    </Modal>
  );
}

function ProductRow({ item, expanded, onToggle }: {
  item: CustomerStockProductItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={styles.rowWrap}>
      <div
        className={styles.row}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className={styles.productInfo}>
          <span className={styles.productName}>{item.productName}</span>
          <span className={styles.productUnit}>{item.productUnit}</span>
        </div>
        <div className={styles.right}>
          <div className={styles.chips}>
            {item.totalSold > 0 && (
              <span className={[styles.chip, styles.chipSold].join(' ')}>Terjual {item.totalSold}</span>
            )}
            {item.totalReturned > 0 && (
              <span className={[styles.chip, styles.chipReturned].join(' ')}>Dikembalikan {item.totalReturned}</span>
            )}
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            width="14"
            height="14"
            className={[styles.chevron, expanded ? styles.chevronOpen : ''].join(' ')}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className={styles.staffPanel}>
          {item.staff.length === 0 ? (
            <p className={styles.emptyText}>Tidak ada rincian staf.</p>
          ) : (
            <>
              <div className={styles.staffHeader}>
                <span>Staf</span>
                <span>Terjual</span>
                <span>Dikembalikan</span>
              </div>
              {item.staff.map((s) => (
                <div key={s.staffName} className={styles.staffRow}>
                  <span className={styles.staffName}>{s.staffName}</span>
                  <span className={styles.staffCell}>
                    {s.sold > 0
                      ? <span className={[styles.chip, styles.chipSold].join(' ')}>{s.sold}</span>
                      : <span className={styles.zero}>—</span>}
                  </span>
                  <span className={styles.staffCell}>
                    {s.returned > 0
                      ? <span className={[styles.chip, styles.chipReturned].join(' ')}>{s.returned}</span>
                      : <span className={styles.zero}>—</span>}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
