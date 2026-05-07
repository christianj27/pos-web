import { useState, useEffect, useCallback } from 'react';
import { userService } from '../../services/userService';
import { useAuth } from '../../hooks/useAuth';
import { Button, Badge, Modal, Input, Select, ConfirmDialog, EmptyState, Spinner } from '../../components/common';
import { ROLE_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/formatCurrency';
import type { User, UserRole } from '../../types';
import styles from './UsersPage.module.scss';

interface UserFormData {
  name: string;
  username: string;
  password: string;
  role: string;
}

const EMPTY_FORM: UserFormData = { name: '', username: '', password: '', role: '' };
const ROLE_OPTIONS = [
  { value: 'owner', label: 'Owner' },
  { value: 'kurir', label: 'Kurir' },
  { value: 'kasir', label: 'Kasir' },
];

export function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<UserFormData>>({});
  const [saving, setSaving] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<User | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await userService.list();
      setUsers(data);
      setError(null);
    } catch {
      setError('Gagal memuat daftar pengguna.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(u: User) {
    setEditTarget(u);
    setFormData({ name: u.name, username: u.username, password: '', role: u.role });
    setFormErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Partial<UserFormData> = {};
    if (!formData.name.trim()) e.name = 'Nama wajib diisi.';
    else if (formData.name.length > 100) e.name = 'Nama tidak boleh lebih dari 100 karakter.';
    if (!formData.username.trim()) e.username = 'Username wajib diisi.';
    else if (formData.username.length > 50) e.username = 'Username tidak boleh lebih dari 50 karakter.';
    else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) e.username = 'Username hanya boleh berisi huruf, angka, dan garis bawah.';
    if (!editTarget && !formData.password) e.password = 'Kata sandi wajib diisi.';
    else if (formData.password && formData.password.length < 8) e.password = 'Kata sandi minimal 8 karakter.';
    if (!formData.role) e.role = 'Peran wajib dipilih.';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await userService.update(editTarget.id, {
          name: formData.name,
          username: formData.username,
          role: formData.role,
          ...(formData.password ? { password: formData.password } : {}),
        });
      } else {
        await userService.create(formData);
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg?.toLowerCase().includes('username')) {
        setFormErrors((p) => ({ ...p, username: 'Username ini sudah digunakan.' }));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      if (confirmTarget.is_active) {
        await userService.deactivate(confirmTarget.id);
      } else {
        await userService.reactivate(confirmTarget.id);
      }
      setConfirmTarget(null);
      load();
    } finally {
      setConfirmLoading(false);
    }
  }

  function setField(field: keyof UserFormData, value: string) {
    setFormData((p) => ({ ...p, [field]: value }));
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Pengguna</h1>
          <Button onClick={openCreate} size="sm">+ Tambah Pengguna</Button>
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}
        {error && <div className={styles.errorBanner}>{error}</div>}

        {!loading && users.length === 0 && (
          <EmptyState message="Belum ada pengguna. Buat pengguna pertama untuk memulai." />
        )}

        {!loading && users.length > 0 && (
          <div className={styles.cardList}>
            {users.map((u) => (
              <div key={u.id} className={[styles.card, !u.is_active ? styles.cardInactive : ''].join(' ')}>
                <div className={styles.cardTop}>
                  <div className={styles.cardInfo}>
                    <span className={styles.cardName}>{u.name}</span>
                    <span className={styles.cardSub}>@{u.username}</span>
                  </div>
                  <div className={styles.cardBadges}>
                    <Badge variant={u.role as UserRole}>{ROLE_LABELS[u.role]}</Badge>
                    <Badge variant={u.is_active ? 'active' : 'inactive'}>{u.is_active ? 'Aktif' : 'Tidak Aktif'}</Badge>
                  </div>
                </div>
                <div className={styles.cardMeta}>{formatDate(u.created_at)}</div>
                <div className={styles.cardActions}>
                  <button className={styles.actionBtn} onClick={() => openEdit(u)}>Edit</button>
                  {u.id !== me?.id && (
                    <button
                      className={[styles.actionBtn, u.is_active ? styles.deactivateBtn : styles.activateBtn].join(' ')}
                      onClick={() => setConfirmTarget(u)}
                    >
                      {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Pengguna' : 'Tambah Pengguna'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} loading={saving}>Simpan</Button>
          </>
        }
      >
        <div className={styles.form}>
          <Input
            label="Nama"
            value={formData.name}
            onChange={(e) => setField('name', e.target.value)}
            error={formErrors.name}
            required
          />
          <Input
            label="Username"
            value={formData.username}
            onChange={(e) => setField('username', e.target.value)}
            error={formErrors.username}
            required
          />
          <Input
            label={editTarget ? 'Kata Sandi Baru (kosongkan jika tidak berubah)' : 'Kata Sandi'}
            type="password"
            value={formData.password}
            onChange={(e) => setField('password', e.target.value)}
            error={formErrors.password}
            required={!editTarget}
          />
          <Select
            label="Peran"
            value={formData.role}
            onChange={(e) => setField('role', e.target.value)}
            options={ROLE_OPTIONS}
            placeholder="Pilih peran..."
            error={formErrors.role}
            required
          />
        </div>
      </Modal>

      {/* Deactivate Confirm */}
      <ConfirmDialog
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleDeactivate}
        title={confirmTarget?.is_active ? 'Nonaktifkan Pengguna' : 'Aktifkan Pengguna'}
        message={
          confirmTarget?.is_active
            ? `Nonaktifkan ${confirmTarget?.name}? Mereka tidak akan bisa login lagi.`
            : `Aktifkan kembali ${confirmTarget?.name}?`
        }
        confirmText={confirmTarget?.is_active ? 'Nonaktifkan' : 'Aktifkan'}
        variant={confirmTarget?.is_active ? 'danger' : 'primary'}
        loading={confirmLoading}
      />
    </div>
  );
}
