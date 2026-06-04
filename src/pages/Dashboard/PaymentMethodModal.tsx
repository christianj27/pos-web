import { Modal } from '../../components/common/Modal/Modal';
import { Button } from '../../components/common/Button/Button';
import { formatCurrency } from '../../utils/formatCurrency';
import type { PaymentMethodBreakdownItem } from '../../types';
import styles from './PaymentMethodModal.module.scss';

interface PaymentMethodModalProps {
  paymentBreakdown: PaymentMethodBreakdownItem[];
  isOpen: boolean;
  onClose: () => void;
}

export function PaymentMethodModal({ paymentBreakdown, isOpen, onClose }: PaymentMethodModalProps) {
  const methodIcons: Record<string, React.ReactNode> = {
    cash: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
      </svg>
    ),
    transfer: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
        <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
        <path d="M12 12m-3 0a3 3 0 106 0a3 3 0 10-6 0" />
      </svg>
    ),
    qris: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 3v18M3 15h6M15 9v6" />
      </svg>
    ),
  };

  const methodColors: Record<string, string> = {
    cash: styles.iconCash,
    transfer: styles.iconTransfer,
    qris: styles.iconQris,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Rincian Metode Pembayaran"
      footer={<Button variant="ghost" onClick={onClose}>Tutup</Button>}
    >
      <div className={styles.breakdownGrid}>
        {paymentBreakdown.map((item) => (
          <div key={item.method} className={styles.methodCard}>
            <div className={[styles.methodIcon, methodColors[item.method] ?? ''].join(' ')}>
              {methodIcons[item.method]}
            </div>
            <div className={styles.methodContent}>
              <p className={styles.methodLabel}>{item.label}</p>
              <p className={styles.methodAmount}>{formatCurrency(item.amount)}</p>
              <p className={styles.methodCount}>{item.count} transaksi</p>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
