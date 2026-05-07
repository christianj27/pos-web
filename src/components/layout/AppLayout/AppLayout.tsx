import { Link, Outlet } from 'react-router-dom';
import { BottomNav } from '../BottomNav/BottomNav';
import { useAuth } from '../../../hooks/useAuth';
import logoSrc from '../../../assets/logo.png';
import styles from './AppLayout.module.scss';

function getRolePrefix(role: string | undefined): string {
  switch (role) {
    case 'owner': return 'O';
    case 'kurir': return 'Kr';
    case 'kasir': return 'Ks';
    default: return '?';
  }
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
              <span className={styles.userName}>{user?.name}</span>
              <div className={styles.avatar} aria-hidden="true">
                {getRolePrefix(user?.role)}
              </div>
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
