import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { locationService } from '../../services/locationService';
import { userService } from '../../services/userService';
import { useToast } from '../../context/ToastContext';
import { Button, Badge, Modal, Input, Select, ConfirmDialog, EmptyState, Spinner } from '../../components/common';
import { LOCATION_TYPE_LABELS } from '../../utils/constants';
import { getErrorMessage } from '../../utils/apiError';
import type { Location, User } from '../../types';
import styles from './LocationsPage.module.scss';

interface LocationFormData {
  name: string;
  type: string;
  assigned_to: string;
}

const EMPTY_FORM: LocationFormData = { name: '', type: '', assigned_to: '' };
const TYPE_OPTIONS = [
  { value: 'warehouse', label: 'Gudang' },
  { value: 'vehicle',   label: 'Kendaraan' },
];

export function LocationsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Location | null>(null);
  const [formData, setFormData] = useState<LocationFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<LocationFormData>>({});
  const [saving, setSaving] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<Location | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const load = useCallback(async () => {
    const [locs, usrs] = await Promise.all([
      locationService.list().catch((err) => { showToast(getErrorMessage(err, 'Gagal memuat lokasi.'), 'error'); return []; }),
      userService.list().catch((err) => { showToast(getErrorMessage(err, 'Gagal memuat pengguna.'), 'error'); return []; }),
    ]);
    setLocations(locs as Location[]);
    setUsers(usrs as User[]);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const activeUsers = users.filter((u) => u.isActive && (u.role === 'owner' || u.role === 'kurir'));
  const userOptions = activeUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }));

  function openCreate() {
    setEditTarget(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(l: Location) {
    setEditTarget(l);
    setFormData({ name: l.name, type: l.type, assigned_to: l.assignedTo ?? '' });
    setFormErrors({});
    setModalOpen(true);
  }

  function validate(): boolean {
    const e: Partial<LocationFormData> = {};
    if (!formData.name.trim()) e.name = 'Nama lokasi wajib diisi.';
    if (!editTarget && !formData.type) e.type = 'Tipe lokasi wajib dipilih.';
    if ((editTarget?.type === 'vehicle' || formData.type === 'vehicle') && !formData.assigned_to)
      e.assigned_to = 'Pengguna wajib dipilih untuk kendaraan.';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      if (editTarget) {
        await locationService.update(editTarget.id, {
          name: formData.name,
          assignedTo: formData.assigned_to || undefined,
          isActive: editTarget.isActive,
        });
        showToast('Lokasi berhasil diperbarui.');
      } else {
        await locationService.create({
          name: formData.name,
          type: formData.type,
          assignedTo: formData.assigned_to || undefined,
        });
        showToast('Lokasi berhasil dibuat.');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Terjadi kesalahan. Silakan coba lagi.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      if (confirmTarget.isActive) {
        await locationService.deactivate(confirmTarget.id, {
          name: confirmTarget.name,
          assignedTo: confirmTarget.assignedTo || undefined,
          isActive: false,
        });
        showToast('Lokasi berhasil dinonaktifkan.');
      } else {
        await locationService.reactivate(confirmTarget.id, {
          name: confirmTarget.name,
          assignedTo: confirmTarget.assignedTo || undefined,
          isActive: true,
        });
        showToast('Lokasi berhasil diaktifkan kembali.');
      }
      setConfirmTarget(null);
      load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Terjadi kesalahan. Silakan coba lagi.'), 'error');
    } finally {
      setConfirmLoading(false);
    }
  }

  function setField(field: keyof LocationFormData, value: string) {
    setFormData((p) => ({ ...p, [field]: value }));
  }

  const isVehicleForm = formData.type === 'vehicle' || editTarget?.type === 'vehicle';

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <button className={styles.backArrow} onClick={() => navigate('/lainnya')} aria-label="Kembali ke Pengaturan">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className={styles.title}>Lokasi</h1>
          </div>
          <Button onClick={openCreate} size="sm">+ Tambah Lokasi</Button>
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {!loading && locations.length === 0 && (
          <EmptyState message="Belum ada lokasi. Tambahkan gudang atau kendaraan." />
        )}

        {!loading && locations.length > 0 && (
          <div className={styles.cardList}>
            {locations.map((l) => (
              <div key={l.id} className={[styles.card, !l.isActive ? styles.cardInactive : ''].join(' ')}>
                <div className={styles.cardTop}>
                  <div className={styles.cardInfo}>
                    <span className={styles.cardName}>{l.name}</span>
                    {l.assignedToName && <span className={styles.cardSub}>{l.assignedToName}</span>}
                  </div>
                  <div className={styles.cardBadges}>
                    <Badge variant={l.type}>{LOCATION_TYPE_LABELS[l.type]}</Badge>
                    <Badge variant={l.isActive ? 'active' : 'inactive'}>{l.isActive ? 'Aktif' : 'Tidak Aktif'}</Badge>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.actionBtn} onClick={() => openEdit(l)}>Edit</button>
                  {l.type !== 'warehouse' && (
                    <button
                      className={[styles.actionBtn, l.isActive ? styles.deactivateBtn : styles.activateBtn].join(' ')}
                      onClick={() => setConfirmTarget(l)}
                    >
                      {l.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? 'Edit Lokasi' : 'Tambah Lokasi'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} loading={saving}>Simpan</Button>
          </>
        }
      >
        <div className={styles.form}>
          <Input
            label="Nama Lokasi"
            value={formData.name}
            onChange={(e) => setField('name', e.target.value)}
            error={formErrors.name}
            required
          />
          {!editTarget && (
            <Select
              label="Tipe"
              value={formData.type}
              onChange={(e) => setField('type', e.target.value)}
              options={TYPE_OPTIONS}
              placeholder="Pilih tipe..."
              error={formErrors.type}
              required
            />
          )}
          {editTarget && (
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Tipe:</span>
              <Badge variant={editTarget.type}>{LOCATION_TYPE_LABELS[editTarget.type]}</Badge>
            </div>
          )}
          {isVehicleForm && (
            <Select
              label="Operator (Owner / Kurir)"
              value={formData.assigned_to}
              onChange={(e) => setField('assigned_to', e.target.value)}
              options={userOptions}
              placeholder="Pilih pengguna..."
              error={formErrors.assigned_to}
              required
            />
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        onConfirm={handleToggleActive}
        title={confirmTarget?.isActive ? 'Nonaktifkan Lokasi' : 'Aktifkan Lokasi'}
        message={confirmTarget?.isActive ? `Nonaktifkan ${confirmTarget?.name}? Kendaraan ini tidak akan bisa digunakan untuk memuat barang.` : `Aktifkan kembali ${confirmTarget?.name}?`}
        confirmText={confirmTarget?.isActive ? 'Nonaktifkan' : 'Aktifkan'}
        loading={confirmLoading}
      />
    </div>
  );
}
