import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userService } from '../../services/userService';
import { useToast } from '../../context/ToastContext';
import { Button, Input, Badge } from '../../components/common';
import { getErrorMessage } from '../../utils/apiError';
import styles from './ProfilePage.module.scss';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isOwner = user?.role === 'owner';
  const { showToast } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError('Nama tidak boleh kosong.'); return; }
    setSavingName(true); setNameError(null);
    try {
      await userService.updateProfile({ name: name.trim() });
      showToast('Profil berhasil diperbarui.');
    } catch (err) {
      setNameError(getErrorMessage(err, 'Gagal menyimpan nama.'));
    } finally { setSavingName(false); }
  }

  async function handleSavePwd(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPwd || !newPwd || !confirmPwd) { setPwdError('Semua kolom wajib diisi.'); return; }
    if (newPwd !== confirmPwd) { setPwdError('Konfirmasi kata sandi tidak cocok.'); return; }
    if (newPwd.length < 8) { setPwdError('Kata sandi minimal 8 karakter.'); return; }
    setSavingPwd(true); setPwdError(null);
    try {
      await userService.updateProfile({ currentPassword: currentPwd, newPassword: newPwd });
      showToast('Kata sandi berhasil diubah.');
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    } catch (err) {
      setPwdError(getErrorMessage(err, 'Kata sandi saat ini tidak benar.'));
    } finally { setSavingPwd(false); }
  }

  const roleLabel: Record<string, string> = { owner: 'Owner', kurir: 'Kurir', kasir: 'Kasir' };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.titleGroup}>
          {isOwner && (
            <button className={styles.backArrow} onClick={() => navigate('/settings')} aria-label="Kembali ke Pengaturan">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
          <h1 className={styles.title}>Profil Saya</h1>
        </div>

        {/* Info */}
        <div className={styles.section}>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Username</span>
            <span className={styles.infoValue}>{user?.username}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Peran</span>
            <Badge variant={user?.role as 'owner' | 'kurir' | 'kasir'}>{roleLabel[user?.role ?? ''] ?? user?.role}</Badge>
          </div>
        </div>

        {/* Edit Name */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Ubah Nama</h2>
          {nameError && <div className={styles.errorBanner}>{nameError}</div>}
          <form className={styles.form} onSubmit={handleSaveName}>
            <Input
              label="Nama Tampil"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit" loading={savingName} size="sm">Simpan Nama</Button>
          </form>
        </div>

        {/* Change Password */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Ubah Kata Sandi</h2>
          {pwdError && <div className={styles.errorBanner}>{pwdError}</div>}
          <form className={styles.form} onSubmit={handleSavePwd}>
            <Input
              label="Kata Sandi Saat Ini"
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              required
            />
            <Input
              label="Kata Sandi Baru"
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              required
            />
            <Input
              label="Konfirmasi Kata Sandi Baru"
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
            />
            <Button type="submit" loading={savingPwd} size="sm">Simpan Kata Sandi</Button>
          </form>
        </div>

        {/* Logout (kurir / kasir only — owner uses /settings) */}
        {!isOwner && (
          <div className={styles.section}>
            <Button variant="danger" onClick={() => logout()} style={{ width: '100%' }}>
              Keluar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
