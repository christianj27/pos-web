import { useState } from 'react';
import { Button, Input, Modal, Select } from '../../components/common';
import { transactionService } from '../../services/transactionService';
import { formatCurrency } from '../../utils/formatCurrency';
import { getErrorMessage } from '../../utils/apiError';
import { useToast } from '../../context/ToastContext';
import type { Product, Transaction } from '../../types';
import styles from './EditTransactionModal.module.scss';

type PaymentMethod = 'cash' | 'transfer' | 'qris';

interface EditRow {
  productId: string;
  quantity: string;
  unitPrice: string;
}

interface Props {
  transaction: Transaction;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}

const PAYMENT_OPTIONS = [
  { value: 'cash', label: 'Tunai' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'qris', label: 'QRIS' },
];

/**
 * FR-STL-008 — fixes an open-day transaction so counted cash can match the system.
 * Mount with `key={transaction.id}` so the fields re-initialise for each transaction.
 * Customers and cancellation are deliberately not editable here.
 */
export function EditTransactionModal({ transaction, products, onClose, onSaved }: Props) {
  const { showToast } = useToast();

  const [rows, setRows] = useState<EditRow[]>(() =>
    transaction.items.map((item) => ({
      productId: item.productId,
      quantity: String(item.quantity),
      unitPrice: String(Math.round(item.unitPrice)),
    })),
  );
  const [paidAmount, setPaidAmount] = useState(() => String(Math.round(transaction.paidAmount)));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(transaction.paymentMethod ?? 'cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState(transaction.notes ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const productOptions = products.map((p) => ({ value: p.id, label: `${p.name} (${p.unit})` }));

  const total = rows.reduce(
    (sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0),
    0,
  );
  const paid = Number(paidAmount) || 0;
  const debt = Math.max(0, total - paid);

  const hasValidRows =
    rows.length > 0 && rows.every((row) => row.productId && Number(row.quantity) > 0);
  const canSave = hasValidRows && paid <= total && reason.trim().length > 0;

  function updateRow(index: number, patch: Partial<EditRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { productId: products[0]?.id ?? '', quantity: '1', unitPrice: '' }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await transactionService.update(transaction.id, {
        items: rows.map((row) => ({
          productId: row.productId,
          quantity: Number(row.quantity),
          unitPrice: Number(row.unitPrice),
        })),
        paidAmount: paid,
        paymentMethod,
        referenceNo: referenceNo.trim() || undefined,
        notes: notes.trim() || undefined,
        reason: reason.trim(),
      });
      showToast('Transaksi berhasil diperbarui.', 'success');
      onSaved();
    } catch (err) {
      showToast(getErrorMessage(err, 'Gagal memperbarui transaksi.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Ubah Transaksi"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button loading={saving} disabled={!canSave} onClick={handleSave}>
            Simpan Perubahan
          </Button>
        </>
      }
    >
      <p className={styles.note}>
        Perubahan hanya bisa dilakukan selama hari tersebut belum disetujui owner. Setiap perubahan
        dicatat beserta alasannya.
      </p>

      <div className={styles.items}>
        {rows.map((row, index) => (
          <div key={index} className={styles.itemRow}>
            <Select
              label={index === 0 ? 'Produk' : undefined}
              value={row.productId}
              onChange={(e) => updateRow(index, { productId: e.target.value })}
              options={productOptions}
            />
            <Input
              label={index === 0 ? 'Jumlah' : undefined}
              type="number"
              min={1}
              value={row.quantity}
              onChange={(e) => updateRow(index, { quantity: e.target.value })}
            />
            <Input
              label={index === 0 ? 'Harga satuan' : undefined}
              currency
              value={row.unitPrice}
              onChange={(e) => updateRow(index, { unitPrice: e.target.value })}
              placeholder="0"
            />
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => removeRow(index)}
              disabled={rows.length === 1}
              aria-label="Hapus baris"
            >
              ×
            </button>
          </div>
        ))}

        <Button variant="secondary" size="sm" onClick={addRow}>
          + Tambah Produk
        </Button>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryRow}>
          <span>Total baru</span>
          <span>{formatCurrency(total)}</span>
        </div>
        <div className={styles.summaryRowStrong}>
          <span>Sisa tagihan</span>
          <span>{formatCurrency(debt)}</span>
        </div>
      </div>

      <div className={styles.fields}>
        <Input
          label="Jumlah bayar"
          currency
          value={paidAmount}
          onChange={(e) => setPaidAmount(e.target.value)}
          placeholder="0"
          error={paid > total ? 'Jumlah bayar tidak boleh melebihi total transaksi.' : undefined}
        />
        <Select
          label="Metode pembayaran"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          options={PAYMENT_OPTIONS}
        />
        <Input
          label="No. referensi (opsional)"
          value={referenceNo}
          onChange={(e) => setReferenceNo(e.target.value)}
          placeholder="Contoh: TRF-12345"
        />
        <Input
          label="Catatan (opsional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tambahkan catatan..."
        />
        <Input
          label="Alasan perubahan"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Contoh: jumlah galon salah input"
          required
          hint="Wajib diisi — tersimpan pada jejak audit."
        />
      </div>
    </Modal>
  );
}
