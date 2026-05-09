import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  type ChartEvent,
  type ActiveElement,
  type TooltipItem,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { dashboardService } from '../../services/dashboardService';
import { usePolling } from '../../hooks/usePolling';
import { Spinner } from '../../components/common/Spinner/Spinner';
import { formatCurrency } from '../../utils/formatCurrency';
import { TRANSACTION_TYPE_LABELS } from '../../utils/constants';
import type { DashboardStats, StockLevel, WeeklyChartEntry, RecentTransaction } from '../../types';
import styles from './DashboardPage.module.scss';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

// FR-DSH-001: dashboard polls every 5 seconds (distinct from shared POLLING_INTERVAL)
const DASHBOARD_POLLING_INTERVAL = 5000;

// --- Design tokens (must match SCSS variables) --------------------------------
const COLOR_DIGITAL_VIOLET   = '#576cdb';
const COLOR_DIGITAL_VIOLET_DK = '#3a52c0';
const COLOR_LIGHT_STROKE     = '#eaedf6';

// --- Helpers ------------------------------------------------------------------

function getTodayWIB(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function formatElapsed(since: Date): string {
  const secs = Math.floor((Date.now() - since.getTime()) / 1000);
  if (secs < 60) return `${secs}s yang lalu`;
  const mins = Math.floor(secs / 60);
  const rem  = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s yang lalu` : `${mins}m yang lalu`;
}

function formatRevenueShort(value: number): string {
  if (value === 0) return 'Rp0';
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1).replace('.0', '')}jt`;
  if (value >= 1_000)    return `Rp${(value / 1_000).toFixed(0)}rb`;
  return `Rp${value}`;
}

const ID_SHORT_DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function getDayLabel(dateStr: string): string {
  return ID_SHORT_DAYS[new Date(dateStr + 'T00:00:00').getDay()];
}

// --- Revenue delta ------------------------------------------------------------

function RevDelta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up  = pct >= 0;
  return (
    <span className={[styles.revDelta, up ? styles.revDeltaUp : styles.revDeltaDown].join(' ')}>
      {up ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="12" height="12">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
      {Math.abs(pct).toFixed(1)}% vs kemarin
    </span>
  );
}

// --- Sub-components -----------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  colorClass?: string;
  valueClass?: string;
  badge?: string;
  delta?: React.ReactNode;
}

function StatCard({ label, value, icon, colorClass, valueClass, badge, delta }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      <div className={[styles.statIcon, colorClass ?? ''].join(' ')}>{icon}</div>
      <div className={styles.statContent}>
        <p className={styles.statLabel}>{label}</p>
        <p className={[styles.statValue, valueClass ?? ''].join(' ')}>
          {value}
          {badge && <span className={styles.lowStockBadge}>{badge}</span>}
        </p>
        {delta}
      </div>
    </div>
  );
}

// --- Chart detail panel -------------------------------------------------------

function ChartDetailPanel({ entry, onClose }: { entry: WeeklyChartEntry; onClose: () => void }) {
  const dateLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(entry.date + 'T00:00:00'));

  return (
    <div className={styles.chartDetailPanel}>
      <div className={styles.chartDetailHeader}>
        <span className={styles.chartDetailDate}>{dateLabel}</span>
        <button className={styles.chartDetailClose} onClick={onClose} aria-label="Tutup">{'✕'}</button>
      </div>
      <div className={styles.chartDetailGrid}>
        <div className={styles.chartDetailItem}>
          <span className={styles.chartDetailLabel}>Pendapatan</span>
          <span className={styles.chartDetailValue}>{formatCurrency(entry.revenue)}</span>
        </div>
        <div className={styles.chartDetailItem}>
          <span className={styles.chartDetailLabel}>Transaksi</span>
          <span className={styles.chartDetailValue}>{entry.transaction_count}</span>
        </div>
        <div className={styles.chartDetailItem}>
          <span className={styles.chartDetailLabel}>Biaya Pembelian</span>
          <span className={styles.chartDetailValue}>{formatCurrency(entry.purchase_cost)}</span>
        </div>
        <div className={styles.chartDetailItem}>
          <span className={styles.chartDetailLabel}>Rata-rata / Transaksi</span>
          <span className={styles.chartDetailValue}>
            {entry.transaction_count > 0 ? formatCurrency(entry.revenue / entry.transaction_count) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Weekly bar chart (Chart.js) ----------------------------------------------

function WeeklyChart({
  entries,
  selectedDate,
  onBarClick,
}: {
  entries: WeeklyChartEntry[];
  selectedDate: string;
  onBarClick: (entry: WeeklyChartEntry) => void;
}) {
  const chartRef = useRef<ChartJS<'bar'>>(null);
  const allZero  = entries.every((e) => e.revenue === 0);

  const labels = entries.map((e) => getDayLabel(e.date));

  const backgroundColors = entries.map((e) =>
    e.date === selectedDate ? COLOR_DIGITAL_VIOLET_DK : COLOR_DIGITAL_VIOLET,
  );
  const borderColors = entries.map((e) =>
    e.date === selectedDate ? COLOR_DIGITAL_VIOLET_DK : COLOR_LIGHT_STROKE,
  );

  const data = {
    labels,
    datasets: [
      {
        data: entries.map((e) => e.revenue),
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false as const,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
      if (elements.length > 0) {
        const idx = elements[0].index;
        onBarClick(entries[idx]);
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => ` ${formatRevenueShort(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6c7693', font: { size: 12 } },
      },
      y: {
        grid: { color: '#eaedf6' },
        border: { dash: [3, 3] },
        ticks: {
          color: '#6c7693',
          font: { size: 11 },
          callback: (value: number | string) =>
            typeof value === 'number' ? formatRevenueShort(value) : value,
        },
      },
    },
    animation: { duration: 300 },
  };

  if (allZero) {
    return <p className={styles.chartEmpty}>Tidak ada data pendapatan untuk minggu ini.</p>;
  }

  return (
    <div className={styles.chartCanvas}>
      <Bar ref={chartRef} data={data} options={options} />
    </div>
  );
}

// --- Recent transactions ------------------------------------------------------

function RecentTransactionRow({ tx }: { tx: RecentTransaction }) {
  const time = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(tx.created_at));

  const debt = tx.total_amount - tx.paid_amount;

  return (
    <div className={styles.recentRow}>
      <span className={styles.recentTime}>{time}</span>
      <div className={styles.recentMeta}>
        <span className={styles.recentCustomer}>{tx.customer_name ?? 'Tanpa Pelanggan'}</span>
        <span className={styles.recentStaff}>{tx.created_by_name} {'·'} {' '}
          <span className={[
            styles.badge,
            tx.type === 'delivery' ? styles.badgeDelivery : styles.badgeCounter,
          ].join(' ')}>
            {TRANSACTION_TYPE_LABELS[tx.type]}
          </span>
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className={styles.recentAmount}>{formatCurrency(tx.total_amount)}</div>
        {debt > 0 && (
          <div className={styles.recentDebt}>Utang {formatCurrency(debt)}</div>
        )}
      </div>
    </div>
  );
}

// --- Warehouse stock ----------------------------------------------------------

function WarehouseStockRow({ item }: { item: StockLevel }) {
  const isRefillable = item.product_category === 'refillable';
  const filledQty = item.quantity_filled ?? 0;
  const totalQty  = item.quantity_total ?? 0;
  const isLow     = isRefillable ? filledQty <= 5 : totalQty <= 5;

  return (
    <div className={styles.stockRow}>
      <div>
        <div className={styles.stockName}>{item.product_name}</div>
        <div className={styles.stockUnit}>{item.product_unit}</div>
      </div>
      <div className={[styles.stockQty, isLow ? styles.lowStock : ''].join(' ')}>
        {isRefillable
          ? `${filledQty} isi \u00B7 ${item.quantity_empty ?? 0} kosong`
          : `${totalQty}`}
        {isLow && <span className={styles.stockWarnBadge}>{'⚠'} Rendah</span>}
      </div>
    </div>
  );
}

// --- Page ---------------------------------------------------------------------

export function DashboardPage() {
  const [stats, setStats]                       = useState<DashboardStats | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState<string | null>(null);
  const [selectedDate, setSelectedDate]         = useState<string>(getTodayWIB());
  const [lastUpdated, setLastUpdated]           = useState<Date | null>(null);
  const [clickedEntry, setClickedEntry]         = useState<WeeklyChartEntry | null>(null);
  const [, forceRender]                         = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const data = await dashboardService.getStats(selectedDate);
      setStats(data);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError('Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  usePolling(fetchStats, DASHBOARD_POLLING_INTERVAL);

  // Tick every 10s to keep "Terakhir diperbarui" fresh
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  const isToday = selectedDate === getTodayWIB();

  const handleBarClick = (entry: WeeklyChartEntry) => {
    setClickedEntry((prev) => prev?.date === entry.date ? null : entry);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.date}>{today}</p>
          </div>
          {loading && <Spinner size="sm" />}
        </div>

        {/* Date filter — FR-DSH-006 */}
        <div className={styles.filterRow}>
          <input
            type="date"
            className={styles.dateInput}
            value={selectedDate}
            max={getTodayWIB()}
            onChange={(e) => { if (e.target.value) { setSelectedDate(e.target.value); setClickedEntry(null); } }}
          />
          {!isToday && (
            <button className={styles.todayBtn} onClick={() => { setSelectedDate(getTodayWIB()); setClickedEntry(null); }}>
              Hari Ini
            </button>
          )}
          {lastUpdated && (
            <span className={styles.lastUpdated}>
              Terakhir diperbarui: {formatElapsed(lastUpdated)}
            </span>
          )}
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {/* Stat cards — FR-DSH-002 (6 cards, 2×3 on mobile) */}
        <section>
          <h2 className={styles.sectionTitle}>Hari {isToday ? 'Ini' : 'Terpilih'}</h2>
          <div className={styles.statsGrid}>
            <StatCard
              label="Pendapatan"
              value={stats ? formatCurrency(stats.today_revenue) : '\u2014'}
              colorClass={styles.iconGreen}
              delta={stats ? (
                <RevDelta current={stats.today_revenue} previous={stats.previous_day_revenue} />
              ) : undefined}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              }
            />
            <StatCard
              label="Biaya Pembelian"
              value={stats ? formatCurrency(stats.today_purchase_cost) : '\u2014'}
              colorClass={styles.iconOrange}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
              }
            />
            <StatCard
              label="Pembayaran Hutang Diterima"
              value={stats ? formatCurrency(stats.today_debt_collected) : '\u2014'}
              colorClass={styles.iconBlue}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
            />
            <StatCard
              label="Total Hutang Pelanggan"
              value={stats ? formatCurrency(stats.total_outstanding_debt) : '\u2014'}
              valueClass={styles.danger}
              colorClass={styles.iconRed}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                  <line x1="12" y1="12" x2="12" y2="16" />
                  <line x1="10" y1="14" x2="14" y2="14" />
                </svg>
              }
            />
            <StatCard
              label="Transaksi"
              value={stats ? String(stats.today_transactions) : '\u2014'}
              colorClass={styles.iconViolet}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              }
            />
            <StatCard
              label="Stok Rendah"
              value={stats ? String(stats.low_stock_count) : '\u2014'}
              valueClass={stats && stats.low_stock_count > 0 ? styles.warning : undefined}
              badge={stats && stats.low_stock_count > 0 ? 'Perlu Restock' : undefined}
              colorClass={styles.iconYellow}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              }
            />
          </div>
        </section>

        {/* Weekly bar chart — FR-DSH-007 */}
        <section>
          <h2 className={styles.sectionTitle}>Pendapatan 7 Hari</h2>
          <div className={styles.chartWrapper}>
            {stats?.weekly_chart ? (
              <>
                <WeeklyChart
                  entries={stats.weekly_chart}
                  selectedDate={selectedDate}
                  onBarClick={handleBarClick}
                />
                {clickedEntry && (
                  <ChartDetailPanel
                    entry={clickedEntry}
                    onClose={() => setClickedEntry(null)}
                  />
                )}
              </>
            ) : (
              <p className={styles.chartEmpty}>Tidak ada data pendapatan untuk minggu ini.</p>
            )}
          </div>
        </section>

        {/* Recent transactions — FR-DSH-003 */}
        <section>
          <h2 className={styles.sectionTitle}>Transaksi Terkini</h2>
          {stats?.recent_transactions && stats.recent_transactions.length > 0 ? (
            <div className={styles.recentList}>
              {stats.recent_transactions.map((tx) => (
                <RecentTransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          ) : (
            <p className={styles.recentEmpty}>Belum ada transaksi tercatat pada tanggal ini.</p>
          )}
        </section>

        {/* Warehouse stock summary — FR-DSH-004 */}
        <section>
          <h2 className={styles.sectionTitle}>Stok Gudang</h2>
          {stats?.warehouse_stock && stats.warehouse_stock.length > 0 ? (
            <div className={styles.stockList}>
              {stats.warehouse_stock.map((item) => (
                <WarehouseStockRow key={item.product_id} item={item} />
              ))}
            </div>
          ) : (
            <p className={styles.recentEmpty}>Tidak ada produk. Tambahkan produk untuk melacak stok.</p>
          )}
        </section>

      </div>
    </div>
  );
}
