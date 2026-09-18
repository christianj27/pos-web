import type { StockPeriod } from '../types';

export interface StockPeriodRange {
  period: StockPeriod;
  /** Inclusive WIB range (YYYY-MM-DD) */
  startDate: string;
  endDate: string;
  /** `false` while a custom range is incomplete, out of order or in the future — no request is issued. */
  valid: boolean;
  error?: string;
}

export const STOCK_PERIOD_OPTIONS: { value: StockPeriod; label: string }[] = [
  { value: 'day',    label: 'Harian' },
  { value: 'week',   label: 'Mingguan' },
  { value: 'month',  label: 'Bulanan' },
  { value: 'year',   label: 'Tahunan' },
  { value: 'custom', label: 'Kustom' },
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Today's date in WIB as YYYY-MM-DD. */
export function todayWIB(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

/**
 * Resolves the FR-DSH-012 period selector into an inclusive WIB date range.
 * Mirrors `StockPeriodRange.cs` on the backend — the mock needs the identical rules client-side
 * so day/week/month/year/custom all resolve the same way with and without the API.
 */
export function resolveStockPeriodRange(
  period: StockPeriod,
  anchorDate: string,
  customStart?: string,
  customEnd?: string,
): StockPeriodRange {
  const anchor = parseIso(anchorDate);

  switch (period) {
    case 'week': {
      // Calendar week, Monday–Sunday, containing the anchor date.
      const mondayOffset = (anchor.getUTCDay() + 6) % 7;
      const start = addDays(anchor, -mondayOffset);
      return { period, startDate: toIso(start), endDate: toIso(addDays(start, 6)), valid: true };
    }

    case 'month': {
      const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
      const end   = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
      return { period, startDate: toIso(start), endDate: toIso(end), valid: true };
    }

    case 'year': {
      const year = anchor.getUTCFullYear();
      return { period, startDate: `${year}-01-01`, endDate: `${year}-12-31`, valid: true };
    }

    case 'custom': {
      if (!customStart || !ISO_DATE.test(customStart) || !customEnd || !ISO_DATE.test(customEnd)) {
        return {
          period, startDate: anchorDate, endDate: anchorDate, valid: false,
          error: 'Tanggal mulai dan tanggal selesai wajib diisi.',
        };
      }
      if (customStart > customEnd) {
        return {
          period, startDate: customStart, endDate: customEnd, valid: false,
          error: 'Tanggal mulai harus sebelum atau sama dengan tanggal selesai.',
        };
      }
      if (customEnd > todayWIB()) {
        return {
          period, startDate: customStart, endDate: customEnd, valid: false,
          error: 'Tanggal tidak boleh di masa depan.',
        };
      }
      return { period, startDate: customStart, endDate: customEnd, valid: true };
    }

    default:
      return { period: 'day', startDate: anchorDate, endDate: anchorDate, valid: true };
  }
}

const dayWithYear = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
const dayNoYear = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric', month: 'short', timeZone: 'UTC',
});
const monthWithYear = new Intl.DateTimeFormat('id-ID', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});

/** Caption shown under the period tabs: "18 Sep 2026", "14 – 20 Sep 2026", "September 2026", "2026". */
export function formatStockPeriodCaption(range: StockPeriodRange): string {
  const start = parseIso(range.startDate);
  const end   = parseIso(range.endDate);

  if (range.period === 'day' || range.startDate === range.endDate) return dayWithYear.format(start);
  if (range.period === 'month') return monthWithYear.format(start);
  if (range.period === 'year')  return String(start.getUTCFullYear());

  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${dayNoYear.format(start)} \u2013 ${dayNoYear.format(end)} ${end.getUTCFullYear()}`;
  }
  return `${dayWithYear.format(start)} \u2013 ${dayWithYear.format(end)}`;
}
