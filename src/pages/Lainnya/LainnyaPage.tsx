import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './LainnyaPage.module.scss';

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function ProductIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 14 6 14s6-8.75 6-14c0-3.314-2.686-6-6-6z" />
      <circle cx="12" cy="8" r="2" />
    </svg>
  );
}

function DebtIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28" aria-hidden="true">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function CashFlowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

interface MasterCard {
  label: string;
  description: string;
  to: string;
  icon: React.ReactNode;
}

export function LainnyaPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const masterCards: MasterCard[] = [
    { label: 'Pengguna', description: 'Kelola akun pengguna sistem', to: '/users', icon: <UsersIcon /> },
    { label: 'Produk', description: 'Kelola katalog produk', to: '/products', icon: <ProductIcon /> },
    { label: 'Lokasi', description: 'Kelola lokasi stok & kendaraan', to: '/locations', icon: <LocationIcon /> },
    { label: 'Pembayaran Hutang', description: 'Riwayat pembayaran hutang', to: '/debt-payments', icon: <DebtIcon /> },
    { label: 'Arus Kas', description: 'Riwayat arus kas harian', to: '/cash-flow', icon: <CashFlowIcon /> },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Lainnya</h1>

        {/* Menu Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Menu</h2>
          <div className={styles.masterGrid}>
            {masterCards.map((card) => (
              <button
                key={card.label}
                className={styles.masterCard}
                onClick={() => navigate(card.to)}
              >
                <span className={styles.masterIcon}>{card.icon}</span>
                <span className={styles.masterLabel}>{card.label}</span>
                <span className={styles.masterDesc}>{card.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Account Section */}
        <div className={styles.accountSection}>
          <h2 className={styles.sectionTitle}>Akun</h2>
          <div className={styles.accountGrid}>
            <button className={styles.accountCard} onClick={() => navigate('/profile')}>
              <span className={styles.accountLabel}>Profil Saya</span>
              <span className={styles.accountDesc}>Edit nama & kata sandi</span>
            </button>
            <button className={styles.logoutCard} onClick={() => logout()}>
              <span className={styles.accountLabel}>Keluar</span>
              <span className={styles.accountDesc}>Keluar dari akun ini</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
