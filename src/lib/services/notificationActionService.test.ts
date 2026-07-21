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

const showAutoRideCandidate = vi.fn(async () => undefined);
const hideAutoRideCandidate = vi.fn(async () => undefined);
const showUndo = vi.fn(async () => undefined);
const hideUndo = vi.fn(async () => undefined);
const start = vi.fn(async () => ({ started: true }));
const stop = vi.fn(async () => ({ stopped: true }));
const updateContent = vi.fn(async () => ({ updated: true }));
const addListener = vi.fn();

vi.mock('../native/quickActionsPlugin', () => ({
  isQuickActionsNative: true,
  quickActionsPlugin: {
    start, stop, updateContent,
    showAutoRideCandidate, hideAutoRideCandidate,
    showUndo, hideUndo,
    addListener,
  },
}));

const confirmPending = vi.fn();
const discardPending = vi.fn();
const getPending = vi.fn();

vi.mock('./rideDetectionService', () => ({
  rideDetectionService: { confirmPending, discardPending, getPending },
}));

const undoLastRide = vi.fn();
const rideList = vi.fn(() => [] as unknown[]);

vi.mock('./rideService', () => ({
  rideService: { undoLastRide, list: rideList },
}));

const endAtomic = vi.fn(async () => null);
const getActive = vi.fn();
const getTotals = vi.fn(() => ({
  tempo_online_minutos: 90, corridas_total: 3, km_total: 42, lucro_total: 120,
}));

vi.mock('./shiftService', () => ({
  shiftService: { getActive, endAtomic, getTotals },
}));

import { eventBus } from '../eventBus';
import { telemetry } from '../telemetry';
import { notificationActionService } from './notificationActionService';
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
    const arg = showAutoRideCandidate.mock.calls[0][0] as { resumo?: string };
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
    const arg = updateContent.mock.calls[0][0] as { content?: string };
    expect(arg.content).toMatch(/3 corridas/);
  });

  it('notification_open é contado ao iniciar o turno', async () => {
    getActive.mockReturnValue({ turno_id: 't1' });
    await notificationActionService.attach();
    expect(telemetry.notificationCounters().notification_open).toBe(1);
  });
});
