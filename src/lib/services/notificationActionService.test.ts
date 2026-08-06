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
    showUndo: h.showUndo, hideUndo: h.hideUndo,
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
  rideService: { undoLastRide: h.undoLastRide, list: h.rideList },
}));

vi.mock('./shiftService', () => ({
  shiftService: { getActive: h.getActive, endAtomic: h.endAtomic, getTotals: h.getTotals },
}));

import { eventBus } from '../eventBus';
import { telemetry } from '../telemetry';
import { notificationActionService, parseQuickRideInput } from './notificationActionService';
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
