import { Link, Outlet } from 'react-router-dom';
import { BottomNav } from '../BottomNav/BottomNav';
import { useAuth } from '../../../hooks/useAuth';
import logoSrc from '../../../assets/logo.png';
import styles from './AppLayout.module.scss';

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function AppLayout() {
  const { user } = useAuth();

  return (
    <div className={styles.layout}>
      {/* Top Navbar */}
      <header className={styles.navbar}>
        <div className={styles.navInner}>
          <div className={styles.brand}>
            <img src={logoSrc} alt="POS Logo" className={styles.logo} />
          </div>
          <div className={styles.navRight}>
            <Link to="/profile" className={styles.profileLink} aria-label="Profil saya">
              <div className={styles.avatar} aria-hidden="true">
                {getInitials(user?.name ?? '')}
              </div>
              <span className={styles.userName}>{user?.name}</span>
            </Link>
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
