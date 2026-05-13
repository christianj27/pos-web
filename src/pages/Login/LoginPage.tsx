import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getRoleDefaultPath } from '../../context/AuthContext';
import { USE_MOCK } from '../../mocks/db';
import { Button } from '../../components/common/Button/Button';
import { Input } from '../../components/common/Input/Input';
import logoSrc from '../../assets/logo.png';
import styles from './LoginPage.module.scss';

const TEST_ACCOUNTS = [
  { label: 'Owner',  username: 'owner',  password: 'owner123',  desc: 'Dashboard, semua menu' },
  { label: 'Kurir',  username: 'kurir1', password: 'kurir123',  desc: 'Transaksi, Stok, Pelanggan' },
  { label: 'Kasir',  username: 'kasir1', password: 'kasir123',  desc: 'Transaksi, Pelanggan, Hutang' },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  function validate(): boolean {
    const e: typeof errors = {};
    if (!username.trim()) e.username = 'Username wajib diisi.';
    if (!password) e.password = 'Kata sandi wajib diisi.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setErrors({});
    try {
      const loggedInUser = await login(username.trim(), password);
      navigate(getRoleDefaultPath(loggedInUser.role), { replace: true });
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 429) {
        setErrors({ form: 'Terlalu banyak percobaan login. Silakan tunggu 15 menit dan coba lagi.' });
      } else {
        setErrors({ form: 'Username atau kata sandi salah.' });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src={logoSrc} alt="POS Logo" className={styles.logo} />
        </div>

        <h1 className={styles.title}>Masuk ke Akun Anda</h1>
        <p className={styles.subtitle}>Sistem POS Air & Gas</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={errors.username}
            required
            disabled={loading}
          />
          <Input
            label="Kata Sandi"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
            disabled={loading}
          />

          {errors.form && (
            <div className={styles.formError} role="alert">
              {errors.form}
            </div>
          )}

          <Button type="submit" fullWidth loading={loading} size="lg">
            Masuk
          </Button>
        </form>

        {/* ── Demo Mode: Test Accounts ───────────────────────────────────── */}
        {USE_MOCK && (
          <div className={styles.testAccounts}>
          <p className={styles.testTitle}>🧪 Mode Demo — Akun Uji Coba</p>
          <div className={styles.testList}>
            {TEST_ACCOUNTS.map((a) => (
              <button
                key={a.username}
                className={styles.testBtn}
                type="button"
                onClick={() => { setUsername(a.username); setPassword(a.password); setErrors({}); }}
              >
                <span className={styles.testRole}>{a.label}</span>
                <span className={styles.testCred}>{a.username} / {a.password}</span>
                <span className={styles.testDesc}>{a.desc}</span>
              </button>
            ))}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
