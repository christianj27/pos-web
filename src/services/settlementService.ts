import { apiClient } from '../hooks/useApi';
import { USE_MOCK, mockDb, uid, delay } from '../mocks/db';
import { ApiError } from '../utils/apiError';
import type {
  Settlement,
  SettlementAuditEntry,
  SettlementDetail,
  SettlementMethod,
  SettlementPreview,
  SettlementStockLine,
  SettlementStatusInfo,
  SubmitSettlementPayload,
  CashAdjustmentPayload,
} from '../types';

const METHODS: SettlementMethod[] = ['cash', 'transfer', 'qris'];

function toWIBDate(isoString: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Jakarta' }).format(new Date(isoString));
}

function todayWib(): string {
  return toWIBDate(new Date().toISOString());
}

// ─── Mock helpers (mirror the backend's DayTotalsCalculator / SettlementGuard) ──

/**
 * Mock-only port of the backend's vehicle reconciliation (DayTotalsCalculator.GetStockTotalsAsync):
 * the on-truck balance per product, derived from the seeded movements. The container-loan columns
 * stay 0 because the mock's loans carry only a creator *name*, not an id, so a per-user day total
 * cannot be attributed reliably — the real API fills them from ContainerLoans.created_by.
 */
function buildMockStocks(userId: string): SettlementStockLine[] {
  const vehicle = mockDb.locations.find(
    (l) => l.assignedTo === userId && l.type === 'vehicle' && l.isActive,
  );
  if (!vehicle) return [];

  const balance = (productId: string, status: string) =>
    mockDb.stockMovements
      .filter((m) => m.productId === productId && (m.containerStatus ?? 'na') === status)
      .reduce(
        (sum, m) =>
          sum +
          (m.toLocationId === vehicle.id ? m.quantity : 0) -
          (m.fromLocationId === vehicle.id ? m.quantity : 0),
        0,
      );

  const productIds = [
    ...new Set(
      mockDb.stockMovements
        .filter((m) => m.toLocationId === vehicle.id || m.fromLocationId === vehicle.id)
        .map((m) => m.productId),
    ),
  ];

  const lines: SettlementStockLine[] = [];

  for (const productId of productIds) {
    const product = mockDb.products.find((p) => p.id === productId);
    if (!product) continue;

    const isRefillable = product.category === 'refillable';
    const filled = isRefillable ? balance(productId, 'filled') : balance(productId, 'na');
    const empty = isRefillable ? balance(productId, 'empty') : 0;

    if (filled === 0 && empty === 0) continue;

    lines.push({
      id: `${productId}-stock-preview`,
      productId,
      productName: product.name,
      productUnit: product.unit,
      isRefillable,
      expectedFilled: filled,
      countedFilled: filled,
      expectedEmpty: empty,
      countedEmpty: empty,
      containersOut: 0,
      containersReturned: 0,
    });
  }

  return lines;
}

/**
 * Mock-only port of the backend day maths. Cash is attributed to the collector who recorded it,
 * so an instalment collected today counts on today's settlement rather than the invoice's day.
 */
function buildMockPreview(userId: string, businessDate: string): SettlementPreview {
  const collected = mockDb.transactions.filter(
    (t) => t.staffId === userId && t.status === 'completed' && toWIBDate(t.createdAt) === businessDate,
  );

  const byMethod = (method: SettlementMethod) =>
    collected.filter((t) => (t.paymentMethod ?? 'cash') === method)
      .reduce((sum, t) => sum + t.paidAmount, 0);

  const adjustments = mockDb.cashAdjustments
    .filter((a) => a.userId === userId && a.businessDate === businessDate)
    .reduce((sum, a) => sum + a.amount, 0);

  const cashIn = byMethod('cash');
  const expectedCash = cashIn + adjustments;

  const existing = mockDb.settlements.find(
    (s) => s.userId === userId && s.businessDate === businessDate,
  );

  return {
    businessDate,
    status: existing?.status ?? 'open',
    settlementId: existing?.id,
    expectedCash,
    countedCash: existing?.countedCash ?? expectedCash,
    cashVariance: (existing?.countedCash ?? expectedCash) - expectedCash,
    cashIn,
    cashOut: 0,
    cashAdjustments: adjustments,
    transferExpected: byMethod('transfer'),
    qrisExpected: byMethod('qris'),
    newDebtTotal: 0,
    debtPaymentTotal: mockDb.debtPayments
      .filter((dp) => dp.createdByName === userId && toWIBDate(dp.createdAt) === businessDate)
      .reduce((sum, dp) => sum + dp.amount, 0),
    methods: METHODS.map((method) => {
      const expectedAmount = method === 'cash' ? expectedCash : byMethod(method);
      return {
        id: `${method}-preview`,
        method,
        expectedAmount,
        countedAmount: expectedAmount,
        variance: 0,
      };
    }),
    stocks: buildMockStocks(userId),
  };
}

function mockBlock(userId: string): SettlementStatusInfo {
  const today = todayWib();
  const pending = mockDb.settlements
    .filter((s) => s.userId === userId && s.status !== 'approved' && s.businessDate < today)
    .sort((a, b) => a.businessDate.localeCompare(b.businessDate))[0];

  if (!pending) return { blocked: false };

  return {
    blocked: true,
    blockingBusinessDate: pending.businessDate,
    blockingStatus: pending.status,
    blockingSettlementId: pending.id,
    message: `Selesaikan settlement ${pending.businessDate} dulu sebelum mencatat data baru.`,
  };
}

function requireSettlement(id: string): Settlement {
  const settlement = mockDb.settlements.find((s) => s.id === id);
  if (!settlement) throw new ApiError('Settlement tidak ditemukan.', 404);
  return settlement;
}

export const settlementService = {
  /**
   * Blocking status for the signed-in user. `mockUserId` is only read in mock mode — the real API
   * resolves the caller from the access token.
   */
  status: (mockUserId?: string): Promise<SettlementStatusInfo> => {
    if (!USE_MOCK) return apiClient.get<SettlementStatusInfo>('/api/settlements/status').then((r) => r.data);
    return delay(mockUserId ? mockBlock(mockUserId) : { blocked: false });
  },

  preview: (date?: string, mockUserId?: string): Promise<SettlementPreview> => {
    if (!USE_MOCK)
      return apiClient
        .get<SettlementPreview>(`/api/settlements/preview${date ? `?date=${date}` : ''}`)
        .then((r) => r.data);

    if (!mockUserId) throw new ApiError('Pengguna tidak dikenal.', 400);
    return delay(buildMockPreview(mockUserId, date ?? todayWib()));
  },

  list: (params?: { from?: string; to?: string; userId?: string; status?: string }): Promise<Settlement[]> => {
    if (!USE_MOCK) {
      const query = new URLSearchParams();
      if (params?.from) query.set('from', params.from);
      if (params?.to) query.set('to', params.to);
      if (params?.userId) query.set('user_id', params.userId);
      if (params?.status) query.set('status', params.status);
      const suffix = query.toString() ? `?${query}` : '';
      return apiClient.get<Settlement[]>(`/api/settlements${suffix}`).then((r) => r.data);
    }

    const rows = mockDb.settlements.filter((s) => {
      if (params?.userId && s.userId !== params.userId) return false;
      if (params?.status && s.status !== params.status) return false;
      if (params?.from && s.businessDate < params.from) return false;
      if (params?.to && s.businessDate > params.to) return false;
      return true;
    });

    return delay([...rows].sort((a, b) => b.businessDate.localeCompare(a.businessDate)));
  },

  /**
   * Owner review detail (FR-STL-013). The mock synthesises the snapshot lines from the current ledger
   * and rebuilds an audit trail from the row's own timestamps, because the mock keeps no audit log.
   */
  get: (id: string): Promise<SettlementDetail> => {
    if (!USE_MOCK) return apiClient.get<SettlementDetail>(`/api/settlements/${id}`).then((r) => r.data);

    const settlement = requireSettlement(id);
    const preview = buildMockPreview(settlement.userId, settlement.businessDate);
    const auditTrail: SettlementAuditEntry[] = [];

    if (settlement.submittedAt) {
      auditTrail.push({
        id: `${settlement.id}-submit`,
        action: 'submit',
        actorName: settlement.userName,
        createdAt: settlement.submittedAt,
      });
    }

    if (settlement.reviewedAt && settlement.status === 'approved') {
      auditTrail.push({
        id: `${settlement.id}-approve`,
        action: 'approve',
        reason: settlement.reviewNote,
        actorName: settlement.reviewerName ?? 'Owner',
        createdAt: settlement.reviewedAt,
      });
    }

    if (settlement.reviewedAt && settlement.status === 'rejected') {
      auditTrail.push({
        id: `${settlement.id}-reject`,
        action: 'reject',
        reason: settlement.reviewNote,
        actorName: settlement.reviewerName ?? 'Owner',
        createdAt: settlement.reviewedAt,
      });
    }

    if (settlement.reviewNote && settlement.status === 'open' && !settlement.reviewedAt) {
      auditTrail.push({
        id: `${settlement.id}-reopen`,
        action: 'reopen',
        reason: settlement.reviewNote,
        actorName: 'Owner',
        createdAt: settlement.createdAt,
      });
    }

    mockDb.cashAdjustments
      .filter((a) => a.userId === settlement.userId && a.businessDate === settlement.businessDate)
      .forEach((a) =>
        auditTrail.push({
          id: a.id,
          action: 'cash_adjustment',
          reason: `${a.amount < 0 ? '-' : '+'}${Math.abs(a.amount)} — ${a.reason}`,
          actorName: 'Owner',
          createdAt: a.createdAt,
        }),
      );

    auditTrail.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const methods = preview.methods.map((m) => {
      const countedAmount = m.method === 'cash' ? settlement.countedCash : m.expectedAmount;
      return { ...m, countedAmount, variance: countedAmount - m.expectedAmount };
    });

    return delay({ settlement, methods, stocks: buildMockStocks(settlement.userId), auditTrail });
  },

  submit: (payload: SubmitSettlementPayload, mockUserId?: string): Promise<Settlement> => {
    if (!USE_MOCK)
      return apiClient.post<Settlement>('/api/settlements/submit', payload).then((r) => r.data);

    if (!mockUserId) throw new ApiError('Pengguna tidak dikenal.', 400);

    const businessDate = payload.businessDate ?? todayWib();
    const preview = buildMockPreview(mockUserId, businessDate);

    const hasActivity = preview.cashIn > 0 || preview.cashAdjustments !== 0;
    if (!hasActivity && !preview.settlementId)
      throw new ApiError('Tidak ada aktivitas pada tanggal tersebut, jadi tidak perlu settlement.', 400);

    if (preview.status === 'approved')
      throw new ApiError(
        `Settlement ${businessDate} sudah disetujui owner dan tidak bisa diajukan ulang.`,
        409,
      );

    const variance = payload.countedCash - preview.expectedCash;
    if (variance !== 0)
      throw new ApiError(
        `Kas fisik tidak sama dengan perhitungan sistem (selisih ${Math.abs(variance)}). ` +
          'Perbaiki transaksinya, atau minta owner mencatat Selisih Kas.',
        409,
      );

    const user = mockDb.users.find((u) => u.id === mockUserId);
    const existing = mockDb.settlements.find(
      (s) => s.userId === mockUserId && s.businessDate === businessDate,
    );

    const row: Settlement = {
      id: existing?.id ?? uid(),
      userId: mockUserId,
      userName: user?.name ?? '',
      businessDate,
      status: 'submitted',
      expectedCash: preview.expectedCash,
      countedCash: payload.countedCash,
      cashVariance: 0,
      transferExpected: preview.transferExpected,
      qrisExpected: preview.qrisExpected,
      newDebtTotal: preview.newDebtTotal,
      debtPaymentTotal: preview.debtPaymentTotal,
      note: payload.note,
      submittedAt: new Date().toISOString(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    if (existing) Object.assign(existing, row);
    else mockDb.settlements.push(row);

    return delay({ ...row });
  },

  approve: (id: string, mockReviewerId?: string): Promise<Settlement> => {
    if (!USE_MOCK)
      return apiClient.post<Settlement>(`/api/settlements/${id}/approve`).then((r) => r.data);

    const settlement = requireSettlement(id);
    if (settlement.status !== 'submitted')
      throw new ApiError('Hanya settlement yang sudah diajukan yang dapat disetujui.', 400);

    settlement.status = 'approved';
    settlement.reviewedAt = new Date().toISOString();
    settlement.reviewerName = mockDb.users.find((u) => u.id === mockReviewerId)?.name ?? 'Owner';

    return delay({ ...settlement });
  },

  reject: (id: string, reason: string, mockReviewerId?: string): Promise<Settlement> => {
    if (!USE_MOCK)
      return apiClient
        .post<Settlement>(`/api/settlements/${id}/reject`, { reason })
        .then((r) => r.data);

    const settlement = requireSettlement(id);
    if (!reason.trim()) throw new ApiError('Alasan penolakan wajib diisi.', 400);

    settlement.status = 'rejected';
    settlement.reviewNote = reason.trim();
    settlement.reviewedAt = new Date().toISOString();
    settlement.reviewerName = mockDb.users.find((u) => u.id === mockReviewerId)?.name ?? 'Owner';

    return delay({ ...settlement });
  },

  reopen: (id: string, reason: string): Promise<Settlement> => {
    if (!USE_MOCK)
      return apiClient
        .post<Settlement>(`/api/settlements/${id}/reopen`, { reason })
        .then((r) => r.data);

    const settlement = requireSettlement(id);
    if (!reason.trim()) throw new ApiError('Alasan membuka kembali wajib diisi.', 400);

    settlement.status = 'open';
    settlement.reviewNote = reason.trim();
    settlement.reviewedAt = undefined;
    settlement.submittedAt = undefined;
    settlement.reviewerName = undefined;

    return delay({ ...settlement });
  },

  /** Owner-only "Selisih Kas" booking. */
  adjust: (payload: CashAdjustmentPayload): Promise<{ message: string }> => {
    if (!USE_MOCK)
      return apiClient
        .post<{ message: string }>('/api/settlements/adjustments', payload)
        .then((r) => r.data);

    if (payload.amount === 0) throw new ApiError('Jumlah selisih kas tidak boleh nol.', 400);
    if (!payload.reason.trim()) throw new ApiError('Alasan selisih kas wajib diisi.', 400);

    const locked = mockDb.settlements.some(
      (s) =>
        s.userId === payload.userId &&
        s.businessDate === payload.businessDate &&
        s.status === 'approved',
    );
    if (locked)
      throw new ApiError(
        'Tanggal tersebut sudah disetujui owner. Buka kembali settlement sebelum mencatat selisih kas.',
        400,
      );

    mockDb.cashAdjustments.push({
      id: uid(),
      userId: payload.userId,
      businessDate: payload.businessDate,
      amount: payload.amount,
      reason: payload.reason.trim(),
      createdAt: new Date().toISOString(),
    });

    return delay({ message: 'Selisih kas berhasil dicatat.' });
  },
};
