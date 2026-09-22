import { useCallback, useEffect, useState } from 'react';
import { settlementService } from '../../services/settlementService';
import { Button, Badge, Modal } from '../../components/common';
import { Spinner } from '../../components/common/Spinner/Spinner';
import { formatCurrency, formatDate } from '../../utils/formatCurrency';
import { getErrorMessage } from '../../utils/apiError';
import { useToast } from '../../context/ToastContext';
import type { Settlement, SettlementDetail } from '../../types';
import styles from './SettlementDetailModal.module.scss';

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

const METHOD_LABEL: Record<string, string> = {
  cash: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
};

const ACTION_LABEL: Record<string, string> = {
  submit: 'Diajukan',
  approve: 'Disetujui',
  reject: 'Ditolak',
  reopen: 'Dibuka kembali',
  cash_adjustment: 'Selisih Kas',
  edit: 'Perubahan transaksi',
};

function formatDateLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${Number(day)} ${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][Number(month) - 1]} ${year}`;
}

interface Props {
  settlement: Settlement;
  onClose: () => void;
  onApprove: (row: Settlement) => Promise<void>;
  onRequestReject: (row: Settlement) => void;
  onRequestReopen: (row: Settlement) => void;
  onRequestAdjust: (row: Settlement) => void;
}

/**
 * FR-STL-013 — the owner's review view. Shows the frozen snapshot (per-method figures and the vehicle
 * reconciliation the user submitted) plus the audit trail, so approval is not made on one summary line.
 */
export function SettlementDetailModal({
  settlement,
  onClose,
  onApprove,
  onRequestReject,
  onRequestReopen,
  onRequestAdjust,
}: Props) {
  const { showToast } = useToast();
  const [detail, setDetail] = useState<SettlementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await settlementService.get(settlement.id));
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memuat detail settlement.'), 'error');
    } finally {
      setLoading(false);
    }
  }, [settlement.id, showToast]);

  // Deferred: setState synchronously in an effect body is disallowed by this repo's lint config.
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const row = detail?.settlement ?? settlement;

  async function handleApprove() {
    setActing(true);
    try {
      await onApprove(row);
      await load();
    } finally {
      setActing(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Detail Settlement"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
          {row.status === 'submitted' && (
            <>
              <Button variant="danger" onClick={() => onRequestReject(row)}>
                Tolak
              </Button>
              <Button loading={acting} onClick={handleApprove}>
                Setujui
              </Button>
            </>
          )}
          {row.status === 'approved' && (
            <Button variant="secondary" onClick={() => onRequestReopen(row)}>
              Buka Kembali
            </Button>
          )}
          {row.status !== 'approved' && (
            <Button variant="ghost" onClick={() => onRequestAdjust(row)}>
              Selisih Kas
            </Button>
          )}
        </>
      }
    >
      {loading ? (
        <div className={styles.center}>
          <Spinner />
        </div>
      ) : (
        <>
          <div className={styles.head}>
            <div>
              <p className={styles.headTitle}>
                {row.userName} · {formatDateLabel(row.businessDate)}
              </p>
              <p className={styles.headSub}>
                Diajukan {row.submittedAt ? formatDate(row.submittedAt) : '—'}
                {row.reviewedAt ? ` · Ditinjau ${formatDate(row.reviewedAt)}` : ''}
                {row.reviewerName ? ` oleh ${row.reviewerName}` : ''}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
          </div>

          <p className={styles.sectionTitle}>Rincian metode pembayaran</p>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Metode</th>
                  <th>Sistem</th>
                  <th>Fisik</th>
                  <th>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {(detail?.methods ?? []).map((line) => (
                  <tr key={line.method}>
                    <td>{METHOD_LABEL[line.method]}</td>
                    <td>{formatCurrency(line.expectedAmount)}</td>
                    <td>{formatCurrency(line.countedAmount)}</td>
                    <td className={line.variance === 0 ? styles.zero : styles.nonZero}>
                      {formatCurrency(line.variance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.rows}>
            <div className={styles.row}>
              <span>Kas yang seharusnya ada</span>
              <span>{formatCurrency(row.expectedCash)}</span>
            </div>
            <div className={styles.rowStrong}>
              <span>Kas fisik dihitung</span>
              <span>{formatCurrency(row.countedCash)}</span>
            </div>
            <div className={styles.row}>
              <span>Piutang baru</span>
              <span>{formatCurrency(row.newDebtTotal)}</span>
            </div>
            <div className={styles.row}>
              <span>Pembayaran hutang diterima</span>
              <span>{formatCurrency(row.debtPaymentTotal)}</span>
            </div>
          </div>

          {detail && detail.stocks.length > 0 && (
            <>
              <p className={styles.sectionTitle}>Rekonsiliasi stok kendaraan</p>
              <p className={styles.hint}>Geser tabel ke samping untuk melihat semua kolom.</p>
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
                    {detail.stocks.map((line) => (
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
            </>
          )}

          <p className={styles.sectionTitle}>Jejak audit</p>
          {detail && detail.auditTrail.length > 0 ? (
            <ul className={styles.auditList}>
              {detail.auditTrail.map((entry) => (
                <li key={entry.id} className={styles.auditItem}>
                  <span className={styles.auditAction}>{ACTION_LABEL[entry.action] ?? entry.action}</span>
                  <span className={styles.auditMeta}>
                    {entry.actorName} · {formatDate(entry.createdAt)}
                  </span>
                  {entry.reason && <span className={styles.auditReason}>{entry.reason}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.hint}>Belum ada aktivitas.</p>
          )}

          {(row.note || row.reviewNote) && (
            <>
              <p className={styles.sectionTitle}>Catatan</p>
              {row.note && <p className={styles.note}>Pengguna: {row.note}</p>}
              {row.reviewNote && <p className={styles.note}>Owner: {row.reviewNote}</p>}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
