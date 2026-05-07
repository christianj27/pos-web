import { Outlet } from 'react-router-dom';
import { BottomNav } from '../BottomNav/BottomNav';
import { useAuth } from '../../../hooks/useAuth';
import logoSrc from '../../../assets/logo.png';
import styles from './AppLayout.module.scss';

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className={styles.layout}>
      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <img src={logoSrc} alt="POS Logo" className={styles.logo} />
          </div>
          <div className={styles.navRight}>
            <span className={styles.userName}>{user?.name}</span>
            <button className={styles.logoutBtn} onClick={logout} aria-label="Keluar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              <span className={styles.logoutLabel}>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
