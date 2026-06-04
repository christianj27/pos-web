import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  ArcElement,
  Legend,
  type ChartEvent,
  type ActiveElement,
  type TooltipItem,
  type Plugin,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { dashboardService } from '../../services/dashboardService';
import { transactionService } from '../../services/transactionService';
import { stockService } from '../../services/stockService';
import { usePolling } from '../../hooks/usePolling';
import { Spinner } from '../../components/common/Spinner/Spinner';
import { Modal } from '../../components/common/Modal/Modal';
import { Button } from '../../components/common/Button/Button';
import { formatCurrency } from '../../utils/formatCurrency';
import { TRANSACTION_TYPE_LABELS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/apiError';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { PaymentMethodModal } from './PaymentMethodModal';
import type { DashboardStats, StockLevel, WeeklyChartEntry, RecentTransaction, Transaction, CustomerDebtSummary, StaffRevenueSummary, StockMovement, DailyStockProductSummary, PaymentMethodBreakdownItem } from '../../types';
import styles from './DashboardPage.module.scss';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, ArcElement, Legend);

// Draws formatted revenue value above each bar
const barDatalabelPlugin: Plugin<'bar'> = {
  id: 'barDatalabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.getDatasetMeta(0).data.forEach((bar, i) => {
      const value = chart.data.datasets[0].data[i];
      if (typeof value !== 'number' || value === 0) return;
      ctx.save();
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#6c7693';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(formatRevenueShort(value), bar.x, bar.y - 4);
      ctx.restore();
    });
  },
};

// FR-DSH-001: dashboard polls every 5 seconds (distinct from shared POLLING_INTERVAL)
const DASHBOARD_POLLING_INTERVAL = 5000;

const PAYMENT_METHOD_LABELS: Record<string, string> = { cash: 'Tunai', transfer: 'Transfer', qris: 'QRIS' };

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
      {Math.abs(pct).toFixed(1)}% dari kemarin
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

function ChartDetailPanel({ entry, onClose, showPurchaseCost }: { entry: WeeklyChartEntry; onClose: () => void; showPurchaseCost: boolean }) {
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
          <span className={styles.chartDetailValue}>{entry.transactionCount}</span>
        </div>
        {showPurchaseCost && (
          <div className={styles.chartDetailItem}>
            <span className={styles.chartDetailLabel}>Biaya Pembelian</span>
            <span className={styles.chartDetailValue}>{formatCurrency(entry.purchaseCost)}</span>
          </div>
        )}
        <div className={styles.chartDetailItem}>
          <span className={styles.chartDetailLabel}>Rata-rata / Transaksi</span>
          <span className={styles.chartDetailValue}>
            {entry.transactionCount > 0 ? formatCurrency(entry.revenue / entry.transactionCount) : '—'}
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
    layout: { padding: { top: 24 } },
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
        display: false,
      },
    },
    animation: { duration: 300 },
  };

  if (allZero) {
    return <p className={styles.chartEmpty}>Tidak ada data pendapatan untuk minggu ini.</p>;
  }

  return (
    <div className={styles.chartCanvas}>
      <Bar ref={chartRef} data={data} options={options} plugins={[barDatalabelPlugin]} />
    </div>
  );
}

// --- Recent transactions ------------------------------------------------------

function RecentTransactionRow({ tx, onClick }: { tx: RecentTransaction; onClick: () => void }) {
  const time = new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(tx.createdAt));

  const debt = tx.totalAmount - tx.paidAmount;

  return (
    <div
      className={styles.recentRow}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <span className={styles.recentTime}>{time}</span>
      <div className={styles.recentMeta}>
        <span className={styles.recentCustomer}>{tx.customerName ?? 'Tanpa Pelanggan'}</span>
        <span className={styles.recentStaff}>{tx.createdByName} {'\u00B7'} {' '}
          <span className={[
            styles.badge,
            tx.type === 'delivery' ? styles.badgeDelivery : styles.badgeCounter,
          ].join(' ')}>
            {TRANSACTION_TYPE_LABELS[tx.type]}
          </span>
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className={styles.recentAmount}>{formatCurrency(tx.totalAmount)}</div>
        {debt > 0 && (
          <div className={styles.recentDebt}>Utang {formatCurrency(debt)}</div>
        )}
      </div>
    </div>
  );
}

// --- Customer debt ------------------------------------------------------------

function CustomerDebtRow({ item, onClick }: { item: CustomerDebtSummary; onClick: () => void }) {
  return (
    <div
      className={styles.debtRow}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className={styles.debtInfo}>
        <span className={styles.debtName}>{item.customerName}</span>
      </div>
      <div className={styles.debtRight}>
        <span className={styles.debtAmount}>{formatCurrency(item.outstandingDebt)}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className={styles.debtChevron}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

// --- Warehouse stock ----------------------------------------------------------

function WarehouseStockRow({ item }: { item: StockLevel }) {
  const isRefillable = item.productCategory === 'refillable';
  const filledQty = item.quantityFilled ?? 0;
  const totalQty  = item.quantityTotal ?? 0;
  const isLow     = isRefillable ? filledQty <= 5 : totalQty <= 5;

  return (
    <div className={styles.stockRow}>
      <div>
        <div className={styles.stockName}>{item.productName}</div>
        <div className={styles.stockUnit}>{item.productUnit}</div>
      </div>
      <div className={[styles.stockQty, isLow ? styles.lowStock : ''].join(' ')}>
        {isRefillable
          ? `${filledQty} isi \u00B7 ${item.quantityEmpty ?? 0} kosong`
          : `${totalQty}`}
        {isLow && <span className={styles.stockWarnBadge}>{'⚠'} Rendah</span>}
      </div>
    </div>
  );
}

// --- Daily stock movement summary row (FR-DSH-012) ----------------------------

function DailyStockSummaryRow({ item, onClick }: { item: DailyStockProductSummary; onClick: () => void }) {
  return (
    <div
      className={styles.summaryRow}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className={styles.summaryProductInfo}>
        <span className={styles.summaryProductName}>{item.productName}</span>
        <span className={styles.summaryProductUnit}>{item.productUnit}</span>
      </div>
      <div className={styles.summaryRight}>
        <div className={styles.summaryDeltas}>
          {item.totalSold > 0 && (
            <span className={[styles.deltaChip, styles.deltaNeg].join(' ')}>Terjual {item.totalSold}</span>
          )}
          {item.totalReceived > 0 && (
            <span className={[styles.deltaChip, styles.deltaPos].join(' ')}>Diterima {item.totalReceived}</span>
          )}
        </div>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className={styles.summaryChevron}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

// --- Stock movement detail modal (FR-DSH-012) ---------------------------------

function StockMovementDetailModal({
  product,
  movements,
  onClose,
}: {
  product: DailyStockProductSummary;
  movements: StockMovement[];
  onClose: () => void;
}) {
  const isRefillable = product.productCategory === 'refillable';

  type StaffBreakdown = { staffName: string; sold: number; received: number };
  const staffMap = new Map<string, StaffBreakdown>();
  for (const m of movements) {
    if (!staffMap.has(m.createdByName))
      staffMap.set(m.createdByName, { staffName: m.createdByName, sold: 0, received: 0 });
    const entry = staffMap.get(m.createdByName)!;
    const isSold = m.movementType === 'dispatch' &&
      (isRefillable ? m.containerStatus === 'filled' : true);
    const isReceived = m.toLocationId != null && m.fromLocationId == null &&
      (isRefillable ? m.containerStatus === 'filled' : true);
    if (isSold)     entry.sold     += m.quantity;
    if (isReceived) entry.received += m.quantity;
  }
  const staffBreakdown = [...staffMap.values()].sort((a, b) => b.sold - a.sold);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Pergerakan Stok — ${product.productName}`}
      footer={<Button variant="ghost" onClick={onClose}>Tutup</Button>}
    >
      {staffBreakdown.length === 0 ? (
        <p className={styles.recentEmpty}>Tidak ada pergerakan stok untuk produk ini.</p>
      ) : (
        <>
          <div className={styles.staffSummaryHeader}>
            <span>Staf</span>
            <span>Terjual</span>
            <span>Diterima</span>
          </div>
          {staffBreakdown.map((s) => (
            <div key={s.staffName} className={styles.staffSummaryRow}>
              <span className={styles.staffSummaryName}>{s.staffName}</span>
              <span className={styles.staffSummaryCell}>
                {s.sold > 0
                  ? <span className={[styles.deltaChip, styles.deltaNeg].join(' ')}>{s.sold}</span>
                  : <span className={styles.staffSummaryZero}>—</span>}
              </span>
              <span className={styles.staffSummaryCell}>
                {s.received > 0
                  ? <span className={[styles.deltaChip, styles.deltaPos].join(' ')}>{s.received}</span>
                  : <span className={styles.staffSummaryZero}>—</span>}
              </span>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}

// --- Pie chart color palette (index-based) ------------------------------------

const PIE_COLORS = [
  '#576cdb', // digital violet
  '#e67e22', // orange
  '#27ae60', // green
  '#e74c3c', // red
  '#8e44ad', // purple
  '#16a085', // teal
];

// --- Staff revenue pie chart (FR-DSH-010) -------------------------------------

function StaffRevenuePieChart({ entries }: { entries: StaffRevenueSummary[] }) {
  const filtered = entries.filter((e) => e.revenue > 0);
  if (filtered.length === 0) {
    return <p className={styles.pieChartEmpty}>Tidak ada data pendapatan untuk hari ini.</p>;
  }

  const data = {
    labels: filtered.map((e) => e.staffName),
    datasets: [
      {
        data: filtered.map((e) => e.revenue),
        backgroundColor: filtered.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#6c7693',
          font: { size: 12 },
          padding: 16,
          generateLabels: (chart: ChartJS) => {
            const meta = chart.getDatasetMeta(0);
            return (chart.data.labels as string[]).map((label, i) => {
              const value = (chart.data.datasets[0].data[i] as number) ?? 0;
              const total = (chart.data.datasets[0].data as number[]).reduce((s, v) => s + v, 0);
              const pct   = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return {
                text: `${label}  ${pct}%`,
                fillStyle: PIE_COLORS[i % PIE_COLORS.length],
                strokeStyle: '#ffffff',
                lineWidth: 2,
                hidden: (meta.data[i] as unknown as { hidden?: boolean })?.hidden ?? false,
                index: i,
              };
            });
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'pie'>) => {
            const value  = ctx.parsed ?? 0;
            const total  = (ctx.dataset.data as number[]).reduce((s, v) => s + v, 0);
            const pct    = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
            return ` ${formatCurrency(value)}  (${pct}%)`;
          },
        },
      },
    },
    animation: { duration: 300 },
  };

  return (
    <div className={styles.pieChartCanvas}>
      <Pie data={data} options={options} />
    </div>
  );
}

// --- Page ---------------------------------------------------------------------

export function DashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';
  const [stats, setStats]                       = useState<DashboardStats | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [selectedDate, setSelectedDate]         = useState<string>(getTodayWIB());
  const [lastUpdated, setLastUpdated]           = useState<Date | null>(null);
  const [clickedEntry, setClickedEntry]         = useState<WeeklyChartEntry | null>(null);
  const [, forceRender]                         = useState(0);
  const [detailTx, setDetailTx]                 = useState<Transaction | null>(null);
  const [detailLoading, setDetailLoading]       = useState(false);
  const [detailStockProduct, setDetailStockProduct]   = useState<DailyStockProductSummary | null>(null);
  const [detailStockMovements, setDetailStockMovements] = useState<StockMovement[] | null>(null);
  const [detailStockLoading, setDetailStockLoading]   = useState(false);
  const [paymentModalOpen, setPaymentModalOpen]       = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const data = await dashboardService.getStats(selectedDate, user);
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memuat data dashboard.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, user]);

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

  async function handleTxRowClick(id: string) {
    setDetailLoading(true);
    try {
      const tx = await transactionService.get(id);
      setDetailTx(tx);
    } finally {
      setDetailLoading(false);
    }
  }

  const handleBarClick = (entry: WeeklyChartEntry) => {
    setClickedEntry((prev) => prev?.date === entry.date ? null : entry);
  };

  async function handleProductSummaryClick(product: DailyStockProductSummary) {
    setDetailStockProduct(product);
    setDetailStockMovements(null);
    setDetailStockLoading(true);
    try {
      const all = await stockService.getMovements(selectedDate);
      setDetailStockMovements(
        all.filter((m) => m.productId === product.productId && !m.isReversed && !m.isReversal),
      );
    } finally {
      setDetailStockLoading(false);
    }
  }

  return (
    <>
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

        {/* Stat cards — FR-DSH-002 (6 cards, 2×3 on mobile) */}
        <section>
          <h2 className={styles.sectionTitle}>Hari {isToday ? 'Ini' : 'Terpilih'}</h2>
          <div className={styles.statsGrid}>
            <div onClick={() => setPaymentModalOpen(true)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPaymentModalOpen(true); }} style={{ cursor: 'pointer' }}>
              <StatCard
                label="Pendapatan"
                value={stats ? formatCurrency(stats.todayRevenue) : '\u2014'}
                colorClass={styles.iconGreen}
                delta={stats ? (
                  <RevDelta current={stats.todayRevenue} previous={stats.previousDayRevenue} />
                ) : undefined}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                  </svg>
                }
              />
            </div>
            {isOwner && (
              <StatCard
                label="Biaya Pembelian"
                value={stats ? formatCurrency(stats.todayPurchaseCost) : '\u2014'}
                colorClass={styles.iconOrange}
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 01-8 0" />
                  </svg>
                }
              />
            )}
            <StatCard
              label="Pembayaran Hutang Diterima"
              value={stats ? formatCurrency(stats.todayDebtCollected) : '\u2014'}
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
              value={stats ? formatCurrency(stats.totalOutstandingDebt) : '\u2014'}
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
              value={stats ? String(stats.todayTransactions) : '\u2014'}
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
              value={stats ? String(stats.lowStockCount) : '\u2014'}
              valueClass={stats && stats.lowStockCount > 0 ? styles.warning : undefined}
              badge={stats && stats.lowStockCount > 0 ? 'Perlu Restock' : undefined}
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
            {stats?.weeklyChart ? (
              <>
                <WeeklyChart
                  entries={stats.weeklyChart}
                  selectedDate={selectedDate}
                  onBarClick={handleBarClick}
                />
                {clickedEntry && (
                  <ChartDetailPanel
                    entry={clickedEntry}
                    onClose={() => setClickedEntry(null)}
                    showPurchaseCost={isOwner}
                  />
                )}
              </>
            ) : (
              <p className={styles.chartEmpty}>Tidak ada data pendapatan untuk minggu ini.</p>
            )}
          </div>
        </section>

        {/* Staff revenue pie chart — FR-DSH-010 (owner only) */}
        {isOwner && (
          <section>
            <h2 className={styles.sectionTitle}>Pendapatan per Staf</h2>
            <div className={styles.chartWrapper}>
              {stats ? (
                <StaffRevenuePieChart entries={stats.staffRevenue ?? []} />
              ) : (
                <p className={styles.pieChartEmpty}>Tidak ada data pendapatan untuk hari ini.</p>
              )}
            </div>
          </section>
        )}

        {/* Recent transactions — FR-DSH-003 */}
        <section>
          <h2 className={styles.sectionTitle}>Transaksi Terkini</h2>
          {detailLoading && <div style={{ padding: '8px 0' }}><Spinner size="sm" /></div>}
          {stats?.recentTransactions && stats.recentTransactions.length > 0 ? (
            <div className={styles.recentList}>
              {stats.recentTransactions.map((tx) => (
                <RecentTransactionRow key={tx.id} tx={tx} onClick={() => handleTxRowClick(tx.id)} />
              ))}
            </div>
          ) : (
            <p className={styles.recentEmpty}>Belum ada transaksi tercatat pada tanggal ini.</p>
          )}
        </section>

        {/* Customer debt — FR-DSH-009 */}
        <section>
          <h2 className={styles.sectionTitle}>Hutang Pelanggan</h2>
          {stats?.customerDebts && stats.customerDebts.length > 0 ? (
            <div className={styles.debtList}>
              {stats.customerDebts.map((item) => (
                <CustomerDebtRow
                  key={item.customerId}
                  item={item}
                  onClick={() => navigate(`/debt-payments/${item.customerId}`)}
                />
              ))}
            </div>
          ) : (
            <p className={styles.recentEmpty}>Tidak ada hutang pelanggan aktif.</p>
          )}
        </section>

        {/* Daily stock movement summary — FR-DSH-012 */}
        <section>
          <h2 className={styles.sectionTitle}>Pergerakan Stok</h2>
          {stats?.dailyStockSummary && stats.dailyStockSummary.length > 0 ? (
            <div className={styles.summaryList}>
              {stats.dailyStockSummary.map((item) => (
                <DailyStockSummaryRow
                  key={item.productId}
                  item={item}
                  onClick={() => handleProductSummaryClick(item)}
                />
              ))}
            </div>
          ) : (
            <p className={styles.recentEmpty}>Tidak ada pergerakan stok pada tanggal ini.</p>
          )}
        </section>

        {/* Warehouse stock summary — FR-DSH-004 */}
        <section>
          <h2 className={styles.sectionTitle}>Stok Gudang</h2>
          {stats?.warehouseStock && stats.warehouseStock.length > 0 ? (
            <div className={styles.stockList}>
              {stats.warehouseStock.map((item) => (
                <WarehouseStockRow key={item.productId} item={item} />
              ))}
            </div>
          ) : (
            <p className={styles.recentEmpty}>Tidak ada produk. Tambahkan produk untuk melacak stok.</p>
          )}
        </section>

      </div>
    </div>

      {/* Transaction Detail Modal — FR-DSH-008 */}
      {detailTx && (
        <Modal
          isOpen={!!detailTx}
          onClose={() => setDetailTx(null)}
          title="Detail Transaksi"
          footer={<Button variant="ghost" onClick={() => setDetailTx(null)}>Tutup</Button>}
        >
          <div className={styles.detailSection}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Tipe</span>
              <span className={styles.detailValue}>{TRANSACTION_TYPE_LABELS[detailTx.transactionType]}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Status</span>
              <span className={[styles.badge, detailTx.status === 'completed' ? styles.badgeCompleted : styles.badgeCancelled].join(' ')}>
                {detailTx.status === 'completed' ? 'Selesai' : 'Dibatalkan'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Tanggal</span>
              <span className={styles.detailValue}>
                {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(detailTx.createdAt))}
              </span>
            </div>
            {detailTx.customerName && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Pelanggan</span>
                <span className={styles.detailValue}>{detailTx.customerName}</span>
              </div>
            )}
            {detailTx.locationName && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Lokasi Stok</span>
                <span className={styles.detailValue}>{detailTx.locationName}</span>
              </div>
            )}
            {detailTx.paymentMethod && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Pembayaran</span>
                <span className={styles.detailValue}>{PAYMENT_METHOD_LABELS[detailTx.paymentMethod] ?? detailTx.paymentMethod}</span>
              </div>
            )}
            {detailTx.staffName && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Dibuat oleh</span>
                <span className={styles.detailValue}>{detailTx.staffName}</span>
              </div>
            )}
            {detailTx.notes && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Catatan</span>
                <span className={styles.detailValue}>{detailTx.notes}</span>
              </div>
            )}
          </div>
          <div className={styles.detailItems}>
            <div className={styles.detailItemHeader}>
              <span>Produk</span>
              <span>Qty</span>
              <span style={{ textAlign: 'right' }}>Subtotal</span>
            </div>
            {detailTx.items.map((item) => (
              <div key={item.productId} className={styles.detailItemRow}>
                <span className={styles.detailItemName}>{item.productName}</span>
                <span className={styles.detailItemQty}>{item.quantity} &times; {formatCurrency(item.unitPrice)}</span>
                <span className={styles.detailItemAmt}>{formatCurrency(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className={styles.detailTotals}>
            <div className={styles.detailTotalRow}>
              <span>Total</span>
              <strong>{formatCurrency(detailTx.totalAmount)}</strong>
            </div>
            <div className={styles.detailTotalRow}>
              <span>Dibayar</span>
              <span>{formatCurrency(detailTx.paidAmount)}</span>
            </div>
            {detailTx.totalAmount - detailTx.paidAmount > 0 && (
              <div className={[styles.detailTotalRow, styles.detailTotalDebt].join(' ')}>
                <span>Sisa Hutang</span>
                <strong>{formatCurrency(detailTx.totalAmount - detailTx.paidAmount)}</strong>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Stock movement detail modal — FR-DSH-012 */}
      {detailStockProduct && !detailStockLoading && detailStockMovements && (
        <StockMovementDetailModal
          product={detailStockProduct}
          movements={detailStockMovements}
          onClose={() => { setDetailStockProduct(null); setDetailStockMovements(null); }}
        />
      )}

      {/* Payment method breakdown modal — FR-DSH-013 */}
      <PaymentMethodModal
        paymentBreakdown={stats?.paymentMethodBreakdown ?? []}
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
      />
    </>
  );
}
