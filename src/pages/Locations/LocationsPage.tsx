import { useState, useEffect, useCallback } from 'react';
import { locationService } from '../../services/locationService';
import { userService } from '../../services/userService';
import { Button, Badge, Modal, Input, Select, ConfirmDialog, EmptyState, Spinner } from '../../components/common';
import { LOCATION_TYPE_LABELS } from '../../utils/constants';
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
      locationService.list().catch(() => []),
      userService.list().catch(() => []),
    ]);
    setLocations(locs as Location[]);
    setUsers(usrs as User[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeUsers = users.filter((u) => u.is_active && (u.role === 'owner' || u.role === 'kurir'));
  const userOptions = activeUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }));

  function openCreate() {
    setEditTarget(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(l: Location) {
    setEditTarget(l);
    setFormData({ name: l.name, type: l.type, assigned_to: l.assigned_to ?? '' });
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
          assigned_to: formData.assigned_to || undefined,
        });
      } else {
        await locationService.create({
          name: formData.name,
          type: formData.type,
          assigned_to: formData.assigned_to || undefined,
        });
      }
      setModalOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    try {
      await locationService.deactivate(confirmTarget.id);
      setConfirmTarget(null);
      load();
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
          <h1 className={styles.title}>Lokasi</h1>
          <Button onClick={openCreate} size="sm">+ Tambah Lokasi</Button>
        </div>

        {loading && <div className={styles.loadingWrap}><Spinner /></div>}

        {!loading && locations.length === 0 && (
          <EmptyState message="Belum ada lokasi. Tambahkan gudang atau kendaraan." />
        )}

        {!loading && locations.length > 0 && (
          <div className={styles.cardList}>
            {locations.map((l) => (
              <div key={l.id} className={[styles.card, !l.is_active ? styles.cardInactive : ''].join(' ')}>
                <div className={styles.cardTop}>
                  <div className={styles.cardInfo}>
                    <span className={styles.cardName}>{l.name}</span>
                    {l.assigned_to_name && <span className={styles.cardSub}>{l.assigned_to_name}</span>}
                  </div>
                  <div className={styles.cardBadges}>
                    <Badge variant={l.type}>{LOCATION_TYPE_LABELS[l.type]}</Badge>
                    <Badge variant={l.is_active ? 'active' : 'inactive'}>{l.is_active ? 'Aktif' : 'Tidak Aktif'}</Badge>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <button className={styles.actionBtn} onClick={() => openEdit(l)}>Edit</button>
                  {l.type !== 'warehouse' && l.is_active && (
                    <button className={[styles.actionBtn, styles.deactivateBtn].join(' ')} onClick={() => setConfirmTarget(l)}>Nonaktifkan</button>
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
        onConfirm={handleDeactivate}
        title="Nonaktifkan Lokasi"
        message={`Nonaktifkan ${confirmTarget?.name}? Kendaraan ini tidak akan bisa digunakan untuk memuat barang.`}
        confirmText="Nonaktifkan"
        loading={confirmLoading}
      />
    </div>
  );
}
