/**
 * Testes do NotificationActionService — Sprint 7 · Checkpoint 3.
 *
 * Mocka o plugin nativo, `rideDetectionService`, `rideService`,
 * `shiftService` e valida:
 *   - showAutoRideCandidate ao surgir pending
 *   - hideAutoRideCandidate ao sumir pending
 *   - confirm-auto → confirmPending
 *   - edit-auto → emite notification:edit-auto
 *   - discard-auto → discardPending
 *   - undo → undoLastRide + hideUndo
 *   - telemetria de todas as ações
 *   - updateContent após rides:changed pós-confirmação
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  showAutoRideCandidate: vi.fn(async (_opts: { resumo?: string }) => undefined),
  hideAutoRideCandidate: vi.fn(async () => undefined),
  showUndo: vi.fn(async (_opts: { resumo?: string }) => undefined),
  hideUndo: vi.fn(async () => undefined),
  start: vi.fn(async (_opts?: { title?: string; content?: string }) => ({ started: true })),
  stop: vi.fn(async () => ({ stopped: true })),
  updateContent: vi.fn(async (_opts: { title?: string; content?: string }) => ({ updated: true })),
  addListener: vi.fn(),
  confirmPending: vi.fn(),
  discardPending: vi.fn(),
  getPending: vi.fn(),
  undoLastRide: vi.fn(),
  registerShiftRide: vi.fn(),
  showToast: vi.fn(async (_o: { message: string }) => undefined),
  rideList: vi.fn(() => [] as unknown[]),
  endAtomic: vi.fn(async () => null),
  getActive: vi.fn(),
  getTotals: vi.fn(() => ({
    tempo_online_minutos: 90, corridas_total: 3, km_total: 42, lucro_total: 120,
  })),
}));

const {
  showAutoRideCandidate, hideAutoRideCandidate, showUndo, hideUndo,
  start, stop, updateContent, addListener,
  confirmPending, discardPending, getPending,
  undoLastRide, rideList, endAtomic, getActive,
} = h;

vi.mock('../native/quickActionsPlugin', () => ({
  isQuickActionsNative: true,
  quickActionsPlugin: {
    start: h.start, stop: h.stop, updateContent: h.updateContent,
    showAutoRideCandidate: h.showAutoRideCandidate,
    hideAutoRideCandidate: h.hideAutoRideCandidate,
    showUndo: h.showUndo, hideUndo: h.hideUndo, showToast: h.showToast,
    addListener: h.addListener,
  },
}));

vi.mock('./rideDetectionService', () => ({
  rideDetectionService: {
    confirmPending: h.confirmPending,
    discardPending: h.discardPending,
    getPending: h.getPending,
  },
}));

vi.mock('./rideService', () => ({
  rideService: {
    undoLastRide: h.undoLastRide,
    list: h.rideList,
    registerShiftRide: h.registerShiftRide,
  },
}));

vi.mock('./shiftService', () => ({
  shiftService: { getActive: h.getActive, endAtomic: h.endAtomic, getTotals: h.getTotals },
}));

import { eventBus } from '../eventBus';
import { telemetry } from '../telemetry';
import { notificationActionService, parseQuickRideInput, toKmOrigin } from './notificationActionService';
import type { QuickActionEvent } from '../native/quickActionsPlugin';

type ActionListener = (e: QuickActionEvent) => void;
let capturedListener: ActionListener | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  capturedListener = null;
  addListener.mockImplementation(async (_ev: string, cb: ActionListener) => {
    capturedListener = cb;
    return { remove: async () => undefined };
  });
  getPending.mockReturnValue(null);
  h.registerShiftRide.mockReturnValue({ id: 'r1', value: 18.5, km: 6.2 });
  getActive.mockReturnValue(null);
  rideList.mockReturnValue([]);
  localStorage.clear();
});

afterEach(async () => {
  await notificationActionService.detach();
});

describe('NotificationActionService · CP3', () => {
  it('showAutoRideCandidate ao surgir pending', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();
    expect(start).toHaveBeenCalledOnce();

    getPending.mockReturnValue({
      id: 'p1', shiftId: 't1', distanceKm: 3.2, durationMin: 8,
      startedAt: '', endedAt: '', confidence: 78, detectedAt: Date.now(),
    });
    eventBus.emit('detection:changed');
    await Promise.resolve();

    expect(showAutoRideCandidate).toHaveBeenCalledTimes(1);
    const arg = showAutoRideCandidate.mock.calls[0][0];
    expect(arg.resumo).toMatch(/km/);
    expect(arg.resumo).toMatch(/confiança 78%/);
  });

  it('hideAutoRideCandidate quando o pending some', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();

    getPending.mockReturnValue({
      id: 'p1', shiftId: 't1', distanceKm: 2, durationMin: 5,
      startedAt: '', endedAt: '', confidence: 70, detectedAt: Date.now(),
    });
    eventBus.emit('detection:changed');
    await Promise.resolve();
    expect(showAutoRideCandidate).toHaveBeenCalledTimes(1);

    getPending.mockReturnValue(null);
  h.registerShiftRide.mockReturnValue({ id: 'r1', value: 18.5, km: 6.2 });
    eventBus.emit('detection:changed');
    await Promise.resolve();

    expect(hideAutoRideCandidate).toHaveBeenCalledTimes(1);
  });

  it('confirm-auto delega em rideDetectionService.confirmPending e registra telemetria', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();
    expect(capturedListener).not.toBeNull();

    capturedListener?.({ type: 'confirm-auto' });
    await Promise.resolve();

    expect(confirmPending).toHaveBeenCalledOnce();
    expect(telemetry.notificationCounters().notification_confirm).toBe(1);
  });

  it('edit-auto emite notification:edit-auto no bus (sem UI duplicada)', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();

    const before = eventBus.getVersion('notification:edit-auto');
    capturedListener?.({ type: 'edit-auto' });
    await Promise.resolve();

    expect(eventBus.getVersion('notification:edit-auto')).toBe(before + 1);
    expect(telemetry.notificationCounters().notification_edit).toBe(1);
  });

  it('discard-auto delega em rideDetectionService.discardPending', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();

    capturedListener?.({ type: 'discard-auto' });
    await Promise.resolve();

    expect(discardPending).toHaveBeenCalledOnce();
    expect(telemetry.notificationCounters().notification_discard).toBe(1);
  });

  it('undo chama rideService.undoLastRide + plugin.hideUndo', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();

    capturedListener?.({ type: 'undo' });
    await Promise.resolve();

    expect(undoLastRide).toHaveBeenCalledOnce();
    expect(hideUndo).toHaveBeenCalledOnce();
    expect(telemetry.notificationCounters().notification_undo).toBe(1);
  });

  it('register arma undo e emite notification:register no bus', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();

    const before = eventBus.getVersion('notification:register');
    capturedListener?.({ type: 'register' });
    await Promise.resolve();

    expect(eventBus.getVersion('notification:register')).toBe(before + 1);
    expect(telemetry.notificationCounters().notification_register).toBe(1);
  });

  it('finish chama shiftService.endAtomic', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();

    capturedListener?.({ type: 'finish' });
    await Promise.resolve();

    expect(endAtomic).toHaveBeenCalledWith('t1');
    expect(telemetry.notificationCounters().notification_finish).toBe(1);
  });

  it('rides:changed dispara updateContent (reatividade pós-confirmação)', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();
    updateContent.mockClear();

    eventBus.emit('rides:changed');
    await Promise.resolve();

    expect(updateContent).toHaveBeenCalledTimes(1);
    const arg = updateContent.mock.calls[0][0];
    expect(arg.content).toMatch(/3 corridas/);
  });

  it('notification_open é contado ao iniciar o turno', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();
    expect(telemetry.notificationCounters().notification_open).toBe(1);
  });
});

describe('parseQuickRideInput (Sprint 10.4.8)', () => {
  it('extrai valor, km e observação', () => {
    expect(parseQuickRideInput('18,50 6,2 centro rápido')).toEqual({
      value: 18.5, km: 6.2, notes: 'centro rápido',
    });
  });

  it('aceita prefixo R$ e sufixo km', () => {
    expect(parseQuickRideInput('R$25.00 8km')).toEqual({
      value: 25, km: 8, notes: undefined,
    });
  });

  it('sem km → km nulo (usa GPS do turno)', () => {
    expect(parseQuickRideInput('12,90')).toEqual({
      value: 12.9, km: null, notes: undefined,
    });
  });

  it('texto sem números → valor nulo', () => {
    expect(parseQuickRideInput('teste').value).toBeNull();
  });
});

describe('Quick Form nativo · Sprint 10.5 (ADR-015)', () => {
  it('traduz kmSource → kmOrigin sem a Activity conhecer o domínio', () => {
    expect(toKmOrigin('user')).toBe('manual');
    expect(toKmOrigin('prefilled')).toBe('auto');
  });

  it('register com form persiste pelo pipeline oficial (rideService)', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();

    capturedListener?.({
      type: 'register',
      form: {
        contractVersion: 1, value: 18.5, km: 6.2,
        kmSource: 'user', clientRequestId: 'quickform:abc', notes: 'centro',
      },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(h.registerShiftRide).toHaveBeenCalledWith(expect.objectContaining({
      shiftId: 't1', value: 18.5, km: 6.2,
      kmOrigin: 'manual', observacao: 'centro', clientRequestId: 'quickform:abc',
    }));
    expect(h.showToast).toHaveBeenCalled();
  });

  it('form com KM pré-preenchido (futuro PRO) vira kmOrigin auto', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();

    capturedListener?.({
      type: 'register',
      form: {
        contractVersion: 1, value: 22, km: 8.4,
        kmSource: 'prefilled', clientRequestId: 'quickform:def',
      },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(h.registerShiftRide).toHaveBeenCalledWith(
      expect.objectContaining({ kmOrigin: 'auto' }),
    );
  });

  it('form inválido não chama o RideService', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();

    capturedListener?.({
      type: 'register',
      form: { contractVersion: 1, value: 0, km: 0, kmSource: 'user', clientRequestId: 'x' },
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(h.registerShiftRide).not.toHaveBeenCalled();
  });
});

// ─── Sprint 10.6.x — KM decimal no Quick Form nativo ────────────────────────
describe('parseDecimalNumber (Quick Form KM/valor decimal)', () => {
  const validBr: Array<[string, number]> = [
    ['0,2', 0.2], ['0,5', 0.5], ['0,75', 0.75],
    ['1,2', 1.2], ['1,75', 1.75], ['2', 2], ['6,2', 6.2], ['10,5', 10.5],
  ];
  const validIntl: Array<[string, number]> = [
    ['0.2', 0.2], ['0.5', 0.5], ['0.75', 0.75],
    ['1.2', 1.2], ['1.75', 1.75], ['6.2', 6.2], ['10.5', 10.5],
  ];

  it.each([...validBr, ...validIntl])('normaliza "%s" → %f', (raw, expected) => {
    expect(parseDecimalNumber(raw)).toBeCloseTo(expected, 6);
  });

  it('aceita number já normalizado', () => {
    expect(parseDecimalNumber(0.5)).toBe(0.5);
    expect(parseDecimalNumber(6.2)).toBe(6.2);
  });

  it('tolera sufixos/prefixos da UI', () => {
    expect(parseDecimalNumber('R$ 18,50')).toBeCloseTo(18.5, 6);
    expect(parseDecimalNumber('0,5 km')).toBeCloseTo(0.5, 6);
  });

  it.each(['0', '0,0', '-1', '-0,5', '', ' ', 'abc', ',', '.', '1,2,3', null, undefined, {}])(
    'rejeita %p',
    (raw) => {
      expect(parseDecimalNumber(raw as unknown)).toBeNull();
    },
  );
});
