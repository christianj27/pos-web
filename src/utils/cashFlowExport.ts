import * as XLSX from 'xlsx';
import type { CashFlowEntry, CashFlowSummary } from '../types';

const CATEGORY_LABELS: Record<string, string> = {
  sale_payment:  'Penjualan',
  debt_payment:  'Bayar Hutang',
  stock_purchase: 'Pembelian Stok',
  debt_created:  'Piutang Dibuat',
};

const FLOW_TYPE_LABELS: Record<string, string> = {
  cash_in:  'Kas Masuk',
  cash_out: 'Kas Keluar',
  new_debt: 'Piutang Baru',
};

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(isoString));
}

function formatTime(isoString: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(isoString));
}

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

function getMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(date);
}

function getDaysInMonth(month: string): string[] {
  const [year, m] = month.split('-').map(Number);
  const count = new Date(year, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    const mo = String(m).padStart(2, '0');
    return `${year}-${mo}-${d}`;
  });
}

function buildSummarySheet(data: CashFlowSummary, month: string): XLSX.WorkSheet {
  const monthLabel = getMonthLabel(month);
  const exportedAt = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date());

  // Group entries by WIB date
  const byDate: Record<string, { cashIn: number; cashOut: number; newDebt: number }> = {};
  for (const entry of data.entries) {
    const d = toWIBDate(entry.createdAt);
    if (!byDate[d]) byDate[d] = { cashIn: 0, cashOut: 0, newDebt: 0 };
    if (entry.flowType === 'cash_in')  byDate[d].cashIn  += entry.amount;
    if (entry.flowType === 'cash_out') byDate[d].cashOut += entry.amount;
    if (entry.flowType === 'new_debt') byDate[d].newDebt += entry.amount;
  }

  const days = getDaysInMonth(month);

  const aoa: (string | number)[][] = [
    [`Laporan Arus Kas Bulanan — ${monthLabel}`],
    [`Diekspor pada: ${exportedAt} WIB`],
    [],
    ['RINGKASAN PERIODE'],
    ['Total Kas Masuk',  data.totalCashIn],
    ['Total Kas Keluar', data.totalCashOut],
    ['Net Kas',          data.netCash],
    ['Total Piutang Baru', data.totalNewDebt],
    [],
    ['RINCIAN HARIAN'],
    ['Tanggal', 'Kas Masuk (Rp)', 'Kas Keluar (Rp)', 'Net Kas (Rp)', 'Piutang Baru (Rp)'],
  ];

  let totalIn = 0, totalOut = 0, totalDebt = 0;
  for (const day of days) {
    const row = byDate[day] ?? { cashIn: 0, cashOut: 0, newDebt: 0 };
    const net = row.cashIn - row.cashOut;
    totalIn   += row.cashIn;
    totalOut  += row.cashOut;
    totalDebt += row.newDebt;
    // Format date as DD/MM/YYYY
    const [y, mo, d] = day.split('-');
    aoa.push([`${d}/${mo}/${y}`, row.cashIn, row.cashOut, net, row.newDebt]);
  }

  aoa.push(['TOTAL', totalIn, totalOut, totalIn - totalOut, totalDebt]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths
  ws['!cols'] = [
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
  ];

  return ws;
}

function buildDetailSheet(entries: CashFlowEntry[]): XLSX.WorkSheet {
  const sorted = [...entries].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const aoa: (string | number)[][] = [
    ['No', 'Tanggal', 'Waktu', 'Jenis Arus', 'Kategori', 'Keterangan', 'Dicatat Oleh', 'Jumlah (Rp)'],
  ];

  sorted.forEach((entry, i) => {
    aoa.push([
      i + 1,
      formatDate(entry.createdAt),
      formatTime(entry.createdAt),
      FLOW_TYPE_LABELS[entry.flowType] ?? entry.flowType,
      CATEGORY_LABELS[entry.category]  ?? entry.category,
      entry.description,
      entry.createdByName,
      entry.amount,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = [
    { wch: 5 },
    { wch: 14 },
    { wch: 8 },
    { wch: 14 },
    { wch: 18 },
    { wch: 40 },
    { wch: 18 },
    { wch: 18 },
  ];

  return ws;
}

export function exportCashFlowToXlsx(data: CashFlowSummary, month: string): void {
  const wb = XLSX.utils.book_new();

  const summarySheet = buildSummarySheet(data, month);
  const detailSheet  = buildDetailSheet(data.entries);

  XLSX.utils.book_append_sheet(wb, summarySheet, 'Ringkasan Bulanan');
  XLSX.utils.book_append_sheet(wb, detailSheet,  'Detail Transaksi');

  const [year, m] = month.split('-');
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const todayStr = today.replace(/-/g, '');

  XLSX.writeFile(wb, `LaporanArusKas_${year}-${m}_diekspor_${todayStr}.xlsx`);
}
