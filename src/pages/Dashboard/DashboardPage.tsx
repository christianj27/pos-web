import { useState, useEffect } from 'react';
import { dashboardService } from '../../services/dashboardService';
import { usePolling } from '../../hooks/usePolling';
import { Spinner } from '../../components/common/Spinner/Spinner';
import { formatCurrency } from '../../utils/formatCurrency';
import { POLLING_INTERVAL } from '../../utils/constants';
import type { DashboardStats } from '../../types';
import styles from './DashboardPage.module.scss';

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  colorClass?: string;
}

function StatCard({ label, value, icon, colorClass }: StatCardProps) {
  return (
    <div className={styles.statCard}>
      <div className={[styles.statIcon, colorClass ?? ''].join(' ')}>{icon}</div>
      <div className={styles.statContent}>
        <p className={styles.statLabel}>{label}</p>
        <p className={styles.statValue}>{value}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const data = await dashboardService.getStats();
      setStats(data);
      setError(null);
    } catch {
      setError('Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);
  usePolling(fetchStats, POLLING_INTERVAL);

  const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Dashboard</h1>
            <p className={styles.date}>{today}</p>
          </div>
          {loading && <Spinner size="sm" />}
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <section>
          <h2 className={styles.sectionTitle}>Hari Ini</h2>
          <div className={styles.statsGrid}>
            <StatCard
              label="Pendapatan"
              value={stats ? formatCurrency(stats.today_revenue) : '—'}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
                </svg>
              }
              colorClass={styles.iconGreen}
            />
            <StatCard
              label="Transaksi"
              value={stats ? String(stats.today_transactions) : '—'}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <path d="M2 10h20" />
                </svg>
              }
              colorClass={styles.iconViolet}
            />
            <StatCard
              label="Biaya Pembelian"
              value={stats ? formatCurrency(stats.today_purchase_cost) : '—'}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 01-8 0" />
                </svg>
              }
              colorClass={styles.iconOrange}
            />
            <StatCard
              label="Pengiriman Aktif"
              value={stats ? String(stats.pending_deliveries) : '—'}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
                  <rect x="1" y="3" width="15" height="13" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
              }
              colorClass={styles.iconBlue}
            />
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Ringkasan</h2>
          <div className={styles.summaryCard}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>Total Hutang Pelanggan</span>
              <span className={[styles.summaryValue, styles.danger].join(' ')}>
                {stats ? formatCurrency(stats.total_outstanding_debt) : '—'}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
