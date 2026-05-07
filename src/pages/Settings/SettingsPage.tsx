import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import styles from './SettingsPage.module.scss';

interface SettingCard {
  label: string;
  description: string;
  to?: string;
  action?: () => void;
  danger?: boolean;
}

export function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const cards: SettingCard[] = [
    { label: 'Pengguna', description: 'Kelola akun pengguna sistem', to: '/users' },
    { label: 'Produk', description: 'Kelola katalog produk', to: '/products' },
    { label: 'Lokasi', description: 'Kelola lokasi stok & kurir', to: '/locations' },
    { label: 'Pembayaran Hutang', description: 'Lihat riwayat pembayaran hutang', to: '/debt-payments' },
    { label: 'Profil Saya', description: 'Edit nama & kata sandi', to: '/profile' },
    {
      label: 'Keluar',
      description: 'Keluar dari akun ini',
      action: () => logout(),
      danger: true,
    },
  ];

  function handleCardClick(card: SettingCard) {
    if (card.action) { card.action(); return; }
    if (card.to) navigate(card.to);
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Pengaturan</h1>
        <div className={styles.grid}>
          {cards.map((card) => (
            <button
              key={card.label}
              className={[styles.card, card.danger ? styles.cardDanger : ''].join(' ')}
              onClick={() => handleCardClick(card)}
            >
              <span className={styles.cardLabel}>{card.label}</span>
              <span className={styles.cardDesc}>{card.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
