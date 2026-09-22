import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { settlementService } from '../../services/settlementService';
import { Button, Input, Select, Modal, Badge, EmptyState } from '../../components/common';
import { Spinner } from '../../components/common/Spinner/Spinner';
import { formatCurrency } from '../../utils/formatCurrency';
import { getErrorMessage } from '../../utils/apiError';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import type { Settlement, SettlementPreview, SettlementStatusInfo } from '../../types';
import { SettlementDetailModal } from './SettlementDetailModal';
import styles from './SettlementPage.module.scss';

const STATUS_LABEL: Record<string, string> = {
  open: 'Belum Ditutup',
  submitted: 'Menunggu Persetujuan',
  rejected: 'Ditolak',
  approved: 'Disetujui',
};

const STATUS_VARIANT: Record<string, 'pending' | 'delivery' | 'cancelled' | 'completed'> = {
  open: 'pending',
  submitted: 'delivery',
  rejected: 'cancelled',
  approved: 'completed',
};

function formatDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${Number(day)} ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][Number(month) - 1]} ${year}`;
}

export function SettlementPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const isOwner = user?.role === 'owner';
  const userId = user?.id;

  const [status, setStatus] = useState<SettlementStatusInfo | null>(null);
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [countedCash, setCountedCash] = useState('');
  const [note, setNote] = useState('');

  const [reviewTarget, setReviewTarget] = useState<Settlement | null>(null);
  const [reviewAction, setReviewAction] = useState<'reject' | 'reopen'>('reject');
  const [detailTarget, setDetailTarget] = useState<Settlement | null>(null);
  const [reviewReason, setReviewReason] = useState('');

  const [adjustTarget, setAdjustTarget] = useState<Settlement | null>(null);
  const [adjustDirection, setAdjustDirection] = useState<'short' | 'over'>('short');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusInfo, previewInfo, rows] = await Promise.all([
        settlementService.status(userId),
        settlementService.preview(undefined, userId),
        settlementService.list({}),
      ]);
      setStatus(statusInfo);
      setPreview(previewInfo);
      setHistory(rows);
      setCountedCash(String(Math.round(previewInfo.expectedCash)));
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memuat data settlement.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, userId]);

  // Deferred like the other pages: calling setState synchronously in an effect body is disallowed by
  // the react-hooks/set-state-in-effect rule this repo enforces.
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function handleSubmit() {
    setSaving(true);
    try {
      await settlementService.submit(
        { countedCash: Number(countedCash || 0), note: note.trim() || undefined },
        user?.id,
      );
      showToast('Settlement berhasil diajukan. Menunggu persetujuan owner.', 'success');
      setNote('');
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal mengajukan settlement.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove(row: Settlement) {
    setSaving(true);
    try {
      await settlementService.approve(row.id, user?.id);
      showToast('Settlement disetujui.', 'success');
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal menyetujui settlement.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleReview() {
    if (!reviewTarget) return;
    setSaving(true);
    try {
      if (reviewAction === 'reject') {
        await settlementService.reject(reviewTarget.id, reviewReason, user?.id);
        showToast('Settlement ditolak. Pengguna harus memperbaiki lalu mengajukan ulang.', 'success');
      } else {
        await settlementService.reopen(reviewTarget.id, reviewReason);
        showToast('Settlement dibuka kembali.', 'success');
      }
      setReviewTarget(null);
      setReviewReason('');
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memproses settlement.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleAdjust() {
    if (!adjustTarget) return;
    setSaving(true);
    try {
      const magnitude = Number(adjustAmount || 0);
      await settlementService.adjust({
        userId: adjustTarget.userId,
        businessDate: adjustTarget.businessDate,
        amount: adjustDirection === 'short' ? -magnitude : magnitude,
        reason: adjustReason,
      });
      showToast('Selisih kas berhasil dicatat.', 'success');
      setAdjustTarget(null);
      setAdjustAmount('');
      setAdjustReason('');
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal mencatat selisih kas.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner size="lg" />
      </div>
    );
  }

  const counted = Number(countedCash || 0);
  const variance = preview ? counted - preview.expectedCash : 0;
  const canSubmit =
    !!preview && preview.status !== 'approved' && variance === 0 && Number(countedCash || 0) >= 0;
  const visibleHistory =
    statusFilter === 'all' ? history : history.filter((row) => row.status === statusFilter);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <button className={styles.backArrow} onClick={() => navigate('/lainnya')} aria-label="Kembali ke Lainnya">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className={styles.title}>Tutup Kas Harian</h1>
          </div>
        </div>

        {status?.blocked && (
          <div className={styles.blockBanner} role="alert">
            <strong>Belum bisa mencatat transaksi baru.</strong>
            <p>{status.message}</p>
          </div>
        )}

        {preview && (
          <div className={styles.card}>
            <div className={styles.cardHead}>
              <div>
                <p className={styles.cardTitle}>Ringkasan {formatDateLabel(preview.businessDate)}</p>
                {preview.vehicleLocationName && (
                  <p className={styles.cardSub}>Kendaraan: {preview.vehicleLocationName}</p>
                )}
              </div>
              <Badge variant={STATUS_VARIANT[preview.status]}>{STATUS_LABEL[preview.status]}</Badge>
            </div>

            <div className={styles.rows}>
              <div className={styles.row}>
                <span>Kas masuk (tunai)</span>
                <span>{formatCurrency(preview.cashIn)}</span>
              </div>
              <div className={styles.row}>
                <span>Kas keluar</span>
                <span>-{formatCurrency(preview.cashOut)}</span>
              </div>
              {preview.cashAdjustments !== 0 && (
                <div className={styles.row}>
                  <span>Penyesuaian selisih kas</span>
                  <span>{formatCurrency(preview.cashAdjustments)}</span>
                </div>
              )}
              <div className={styles.rowStrong}>
                <span>Kas yang seharusnya ada</span>
                <span>{formatCurrency(preview.expectedCash)}</span>
              </div>
              <div className={styles.row}>
                <span>Transfer</span>
                <span>{formatCurrency(preview.transferExpected)}</span>
              </div>
              <div className={styles.row}>
                <span>QRIS</span>
                <span>{formatCurrency(preview.qrisExpected)}</span>
              </div>
              <div className={styles.row}>
                <span>Piutang baru</span>
                <span>{formatCurrency(preview.newDebtTotal)}</span>
              </div>
              <div className={styles.row}>
                <span>Pembayaran hutang diterima</span>
                <span>{formatCurrency(preview.debtPaymentTotal)}</span>
              </div>
            </div>

            {preview.stocks.length > 0 && (
              <div className={styles.stockBlock}>
                <p className={styles.cardSub}>Rekonsiliasi stok kendaraan</p>
                <p className={styles.tableHint}>Geser tabel ke samping untuk melihat semua kolom.</p>
                {/* The 7-column table is wider than a phone screen. It scrolls inside this wrapper
                    only, so the page itself never scrolls sideways. */}
                <div className={styles.tableScroll}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Produk</th>
                        <th>Terisi sistem</th>
                        <th>Terisi fisik</th>
                        <th>Kosong sistem</th>
                        <th>Kosong fisik</th>
                        <th>Kontainer keluar</th>
                        <th>Kontainer kembali</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.stocks.map((line) => (
                        <tr key={line.productId}>
                          <td>{line.productName}</td>
                          <td>{line.expectedFilled}</td>
                          <td>{line.countedFilled}</td>
                          <td>{line.expectedEmpty}</td>
                          <td>{line.countedEmpty}</td>
                          <td>{line.containersOut}</td>
                          <td>{line.containersReturned}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.status !== 'approved' && (
              <div className={styles.form}>
                <Input
                  label="Kas fisik yang dihitung"
                  currency
                  value={countedCash}
                  onChange={(e) => setCountedCash(e.target.value)}
                  placeholder="0"
                  hint="Masukkan jumlah uang tunai yang benar-benar ada."
                />
                <Input
                  label="Catatan (opsional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contoh: titipan kurir Andi"
                />

                <div className={variance === 0 ? styles.varianceOk : styles.varianceBad}>
                  {variance === 0
                    ? 'Kas fisik sudah sama dengan perhitungan sistem.'
                    : `Selisih ${formatCurrency(Math.abs(variance))} (${variance > 0 ? 'lebih' : 'kurang'}). ` +
                      'Perbaiki transaksi yang salah, atau minta owner mencatat Selisih Kas.'}
                </div>

                <Button fullWidth loading={saving} disabled={!canSubmit} onClick={handleSubmit}>
                  Tutup Kas &amp; Ajukan
                </Button>
              </div>
            )}
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              {isOwner ? 'Settlement Semua Pengguna' : 'Riwayat Settlement Saya'}
            </h2>
            {isOwner && (
              <div className={styles.filters}>
                {['all', 'submitted', 'approved', 'rejected'].map((value) => (
                  <button
                    key={value}
                    className={[styles.filter, statusFilter === value ? styles.filterActive : ''].join(' ')}
                    onClick={() => setStatusFilter(value)}
                  >
                    {value === 'all' ? 'Semua' : STATUS_LABEL[value]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {visibleHistory.length === 0 ? (
            <EmptyState message="Belum ada settlement." />
          ) : (
            <div className={styles.cardList}>
              {visibleHistory.map((row) => (
                <div key={row.id} className={styles.historyCard}>
                  <div className={styles.historyTop}>
                    <div>
                      <p className={styles.historyTitle}>
                        {row.userName} · {formatDateLabel(row.businessDate)}
                      </p>
                      <p className={styles.historySub}>
                        Sistem {formatCurrency(row.expectedCash)} · Fisik {formatCurrency(row.countedCash)}
                      </p>
                      {row.reviewNote && <p className={styles.historyNote}>{row.reviewNote}</p>}
                    </div>
                    <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                  </div>

                  {isOwner && (
                    <div className={styles.actions}>
                      <Button size="sm" variant="secondary" onClick={() => setDetailTarget(row)}>
                        Detail
                      </Button>
                      {row.status === 'submitted' && (
                        <>
                          <Button size="sm" loading={saving} onClick={() => handleApprove(row)}>
                            Setujui
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setReviewTarget(row);
                              setReviewAction('reject');
                              setReviewReason('');
                            }}
                          >
                            Tolak
                          </Button>
                        </>
                      )}
                      {row.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setReviewTarget(row);
                            setReviewAction('reopen');
                            setReviewReason('');
                          }}
                        >
                          Buka Kembali
                        </Button>
                      )}
                      {row.status !== 'approved' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAdjustTarget(row);
                            setAdjustDirection('short');
                            setAdjustAmount('');
                            setAdjustReason('');
                          }}
                        >
                          Selisih Kas
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={reviewTarget !== null}
        onClose={() => setReviewTarget(null)}
        title={reviewAction === 'reject' ? 'Tolak Settlement' : 'Buka Kembali Settlement'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewTarget(null)}>
              Batal
            </Button>
            <Button
              variant={reviewAction === 'reject' ? 'danger' : 'primary'}
              loading={saving}
              disabled={!reviewReason.trim()}
              onClick={handleReview}
            >
              {reviewAction === 'reject' ? 'Tolak' : 'Buka Kembali'}
            </Button>
          </>
        }
      >
        <Input
          label="Alasan"
          value={reviewReason}
          onChange={(e) => setReviewReason(e.target.value)}
          placeholder={reviewAction === 'reject' ? 'Contoh: kas kurang Rp 5.000' : 'Contoh: salah input'}
          required
        />
      </Modal>

      <Modal
        isOpen={adjustTarget !== null}
        onClose={() => setAdjustTarget(null)}
        title="Catat Selisih Kas"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustTarget(null)}>
              Batal
            </Button>
            <Button
              loading={saving}
              disabled={!adjustReason.trim() || Number(adjustAmount || 0) <= 0}
              onClick={handleAdjust}
            >
              Simpan
            </Button>
          </>
        }
      >
        <p className={styles.modalNote}>
          Selisih kas dipakai kalau uangnya memang kurang atau lebih secara nyata. Setelah dicatat,
          pengguna bisa menutup hari dengan selisih nol.
        </p>
        <Select
          label="Jenis selisih"
          value={adjustDirection}
          onChange={(e) => setAdjustDirection(e.target.value as 'short' | 'over')}
          options={[
            { value: 'short', label: 'Kas kurang (uang keluar)' },
            { value: 'over', label: 'Kas lebih (uang masuk)' },
          ]}
        />
        <Input
          label="Jumlah"
          currency
          value={adjustAmount}
          onChange={(e) => setAdjustAmount(e.target.value)}
          placeholder="0"
        />
        <Input
          label="Alasan"
          value={adjustReason}
          onChange={(e) => setAdjustReason(e.target.value)}
          placeholder="Contoh: hilang saat pengiriman"
          required
        />
      </Modal>

      {/* FR-STL-013 — owner review detail. Reject/reopen/Selisih Kas close this modal and hand off to
          the reason-required modals above instead of nesting modals. */}
      {detailTarget && (
        <SettlementDetailModal
          settlement={detailTarget}
          onClose={() => setDetailTarget(null)}
          onApprove={handleApprove}
          onRequestReject={(row) => {
            setDetailTarget(null);
            setReviewTarget(row);
            setReviewAction('reject');
            setReviewReason('');
          }}
          onRequestReopen={(row) => {
            setDetailTarget(null);
            setReviewTarget(row);
            setReviewAction('reopen');
            setReviewReason('');
          }}
          onRequestAdjust={(row) => {
            setDetailTarget(null);
            setAdjustTarget(row);
            setAdjustDirection('short');
            setAdjustAmount('');
            setAdjustReason('');
          }}
        />
      )}
    </div>
  );
}
