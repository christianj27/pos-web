import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import styles from './BottomNav.module.scss';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75V21a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75v-5.25h-4.5V21a.75.75 0 01-.75.75H3.75A.75.75 0 013 21V9.75z" />
    </svg>
  );
}
function TxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
function StockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <path strokeLinecap="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
      <path strokeLinecap="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
    </svg>
  );
}
function CustomerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function LainnyaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
      <rect x="3"  y="3"  width="8" height="8" rx="2" />
      <rect x="13" y="3"  width="8" height="8" rx="2" />
      <rect x="3"  y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}
function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="22" height="22">
      <circle cx="12" cy="8" r="4" />
      <path strokeLinecap="round" d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

// Role-specific nav items (max 5 per role)
const OWNER_NAV: NavItem[] = [
  { to: '/dashboard',    label: 'Dashboard',  icon: <HomeIcon /> },
  { to: '/transactions', label: 'Transaksi',  icon: <TxIcon /> },
  { to: '/stock',        label: 'Stok',       icon: <StockIcon /> },
  { to: '/customers',    label: 'Pelanggan',  icon: <CustomerIcon /> },
  { to: '/lainnya',     label: 'Lainnya',     icon: <LainnyaIcon /> },
];

const KURIR_NAV: NavItem[] = [
  { to: '/transactions', label: 'Transaksi', icon: <TxIcon /> },
  { to: '/stock',        label: 'Stok',      icon: <StockIcon /> },
  { to: '/customers',    label: 'Pelanggan', icon: <CustomerIcon /> },
  { to: '/profile',      label: 'Profil',    icon: <ProfileIcon /> },
];

const KASIR_NAV: NavItem[] = [
  { to: '/transactions', label: 'Transaksi', icon: <TxIcon /> },
  { to: '/stock',        label: 'Stok',      icon: <StockIcon /> },
  { to: '/customers',    label: 'Pelanggan', icon: <CustomerIcon /> },
  { to: '/profile',      label: 'Profil',    icon: <ProfileIcon /> },
];

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  owner: OWNER_NAV,
  kurir: KURIR_NAV,
  kasir: KASIR_NAV,
};

const SETTINGS_SUB_PATHS = ['/users', '/products', '/locations', '/debt-payments', '/profile', '/cash-flow'];

export function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role ?? '';

  const visible = NAV_BY_ROLE[role] ?? [];

  return (
    <nav className={styles.nav} aria-label="Navigasi utama">
      {visible.map((item) => {
        const isSettingsSubPath =
          role === 'owner' &&
          item.to === '/lainnya' &&
          SETTINGS_SUB_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));

        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [styles.item, isActive || isSettingsSubPath ? styles.active : ''].join(' ')
            }
          >
            <span className={styles.iconWrap}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
