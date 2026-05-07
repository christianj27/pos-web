/**
 * Format a number as Indonesian Rupiah currency string.
 * e.g. 15000 → "Rp 15.000"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a number with thousand-separator dots (no currency symbol).
 * e.g. 15000 → "15.000"
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

/**
 * Format ISO date string to Indonesian locale.
 * e.g. "2026-05-07T10:30:00Z" → "7 Mei 2026, 17:30"
 */
export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(isoString));
}

/**
 * Format ISO date string to date only.
 * e.g. "2026-05-07T10:30:00Z" → "7 Mei 2026"
 */
export function formatDateOnly(isoString: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(isoString));
}
