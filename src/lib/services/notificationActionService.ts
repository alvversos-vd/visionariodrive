/**
 * NotificationActionService — Sprint 7 · Checkpoint 3.
 *
 * Tradutor entre o plugin nativo `VisionarioQuickActions` e as camadas
 * oficiais (Services + EventBus). Não persiste, não calcula, não acessa
 * Repositories/Storage/Supabase/CloudSync.
 *
 * Ciclo completo (CP1–CP3):
 *   - start/stop do Foreground Service acompanha shift:started/finished.
 *   - updateContent reativo por shift:changed / rides:changed.
 *   - Registrar → arma janela de Undo → emite `notification:register` no bus.
 *   - Finalizar → shiftService.endAtomic.
 *   - Undo → rideService.undoLastRide.
 *   - Auto Ride (CP3):
 *       pending detectado  → plugin.showAutoRideCandidate
 *       pending removido   → plugin.hideAutoRideCandidate
 *       confirm-auto       → rideDetectionService.confirmPending() (mesmo fluxo do toast)
 *       edit-auto          → emite notification:edit-auto (BottomSheet React existente)
 *       discard-auto       → rideDetectionService.discardPending()
 *   - Telemetria: apenas contadores agregados (sem PII) via `telemetry.recordNotification`.
 */
import type { PluginListenerHandle } from '@capacitor/core';

import { eventBus } from '../eventBus';
import { shiftService, type Shift, type ShiftTotals } from './shiftService';
import { rideService } from './rideService';
import { rideDetectionService, type PendingRide } from './rideDetectionService';
import { telemetry } from '../telemetry';
import {
  quickActionsPlugin,
  isQuickActionsNative,
  type QuickActionEvent,
} from '../native/quickActionsPlugin';

type Unsub = () => void;

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
});
const BRL_SHORT = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
});

function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h <= 0) return `${rem.toString().padStart(2, '0')}min`;
  return `${h.toString().padStart(2, '0')}h${rem.toString().padStart(2, '0')}`;
}

function buildContent(shift: Shift, totals: ShiftTotals): string {
  const tempo = formatDuration(totals.tempo_online_minutos);
  const corridas = totals.corridas_total;
  const km = totals.km_total.toFixed(0);
  const lucro = BRL.format(totals.lucro_total);
  return `${tempo} · ${corridas} ${corridas === 1 ? 'corrida' : 'corridas'} · ${km} km · ${lucro}`;
}

function buildAutoLabel(p: PendingRide): string {
  return `${p.distanceKm.toFixed(1)} km · ${Math.round(p.durationMin)} min · confiança ${p.confidence}%`;
}

/** Janela em ms para associar um `rides:manual-registered` ao clique
 *  "Registrar" da notificação — usada apenas para disparar o showUndo
 *  nativo (o timer de 10s vive no plugin Android). */
const UNDO_ARM_WINDOW_MS = 90_000;

class NotificationActionServiceImpl {
  private attached = false;
  private busUnsubs: Unsub[] = [];
  private actionListener: PluginListenerHandle | null = null;
  private started = false;
  private undoArmedUntil = 0;
  private lastPendingId: string | null = null;

  async attach(): Promise<void> {
    if (this.attached) return;
    this.attached = true;

    this.busUnsubs.push(
      eventBus.subscribe('shift:started', () => { void this.handleShiftStarted(); }),
      eventBus.subscribe('shift:finished', () => { void this.handleShiftFinished(); }),
      eventBus.subscribe('shift:changed', () => { void this.pushContent(); }),
      eventBus.subscribe('rides:changed', () => { void this.pushContent(); }),
      eventBus.subscribe('rides:manual-registered', () => { void this.handleManualRegistered(); }),
      eventBus.subscribe('detection:changed', () => { void this.handleDetection(); }),
    );

    try {
      this.actionListener = await quickActionsPlugin.addListener('action', (e) => {
        void this.onPluginAction(e);
      });
    } catch {
      this.actionListener = null;
    }

    const active = shiftService.getActive();
    if (active) await this.handleShiftStarted();
  }

  async detach(): Promise<void> {
    if (!this.attached) return;
    this.attached = false;
    this.undoArmedUntil = 0;
    this.lastPendingId = null;
    for (const u of this.busUnsubs) { try { u(); } catch { /* noop */ } }
    this.busUnsubs = [];
    if (this.actionListener) {
      try { await this.actionListener.remove(); } catch { /* noop */ }
      this.actionListener = null;
    }
    if (this.started) {
      try { await quickActionsPlugin.stop(); } catch { /* noop */ }
      this.started = false;
    }
  }

  // ─── Ciclo do turno ───────────────────────────────────────────────
  private async handleShiftStarted(): Promise<void> {
    const active = shiftService.getActive();
    if (!active) return;
    const totals = shiftService.getTotals(active);
    try {
      await quickActionsPlugin.start({
        title: 'Turno em andamento',
        content: buildContent(active, totals),
      });
      this.started = true;
      telemetry.recordNotification('notification_open');
    } catch { /* noop */ }
  }

  private async handleShiftFinished(): Promise<void> {
    this.undoArmedUntil = 0;
    this.lastPendingId = null;
    if (!this.started) return;
    try { await quickActionsPlugin.stop(); } catch { /* noop */ }
    this.started = false;
  }

  // ─── Atualização reativa (bus → notificação) ──────────────────────
  private async pushContent(): Promise<void> {
    if (!this.started) return;
    const active = shiftService.getActive();
    if (!active) return;
    const totals = shiftService.getTotals(active);
    try {
      await quickActionsPlugin.updateContent({
        title: 'Turno em andamento',
        content: buildContent(active, totals),
      });
    } catch { /* noop */ }
  }

  private async handleManualRegistered(): Promise<void> {
    if (!this.started) return;
    if (Date.now() > this.undoArmedUntil) return;
    this.undoArmedUntil = 0;
    const last = latestRide();
    const resumo = last
      ? `${last.km.toFixed(0)} km · ${BRL_SHORT.format(last.value)}`
      : undefined;
    try { await quickActionsPlugin.showUndo({ resumo }); } catch { /* noop */ }
  }

  // ─── Auto Ride (CP3) ──────────────────────────────────────────────
  private async handleDetection(): Promise<void> {
    if (!this.started) return;
    const pending = rideDetectionService.getPending();
    if (pending) {
      if (this.lastPendingId === pending.id) return;
      this.lastPendingId = pending.id;
      try { await quickActionsPlugin.showAutoRideCandidate({ resumo: buildAutoLabel(pending) } as unknown as { resumo?: string }); }
      catch { /* noop */ }
      return;
    }
    // Sem pending → esconde candidato.
    if (this.lastPendingId !== null) {
      this.lastPendingId = null;
      try { await quickActionsPlugin.hideAutoRideCandidate(); } catch { /* noop */ }
    }
  }

  // ─── Ações vindas do plugin (transporte → Services) ───────────────
  private async onPluginAction(event: QuickActionEvent): Promise<void> {
    switch (event.type) {
      case 'register': {
        this.undoArmedUntil = Date.now() + UNDO_ARM_WINDOW_MS;
        telemetry.recordNotification('notification_register');
        eventBus.emit('notification:register');
        return;
      }
      case 'finish': {
        const active = shiftService.getActive();
        if (!active) return;
        telemetry.recordNotification('notification_finish');
        try { await shiftService.endAtomic(active.turno_id); } catch { /* noop */ }
        return;
      }
      case 'undo': {
        telemetry.recordNotification('notification_undo');
        try { rideService.undoLastRide(); } catch { /* noop */ }
        try { await quickActionsPlugin.hideUndo(); } catch { /* noop */ }
        return;
      }
      case 'confirm-auto': {
        telemetry.recordNotification('notification_confirm');
        try { rideDetectionService.confirmPending(); } catch { /* noop */ }
        return;
      }
      case 'edit-auto': {
        telemetry.recordNotification('notification_edit');
        eventBus.emit('notification:edit-auto');
        return;
      }
      case 'discard-auto': {
        telemetry.recordNotification('notification_discard');
        try { rideDetectionService.discardPending(); } catch { /* noop */ }
        return;
      }
      default:
        return;
    }
  }
}

function latestRide() {
  const all = rideService.list();
  if (all.length === 0) return null;
  return all.reduce((a, b) =>
    new Date(a.date).getTime() >= new Date(b.date).getTime() ? a : b,
  );
}

export const notificationActionService = new NotificationActionServiceImpl();

export const _notificationActionInternals = { buildContent, formatDuration, buildAutoLabel };

export const notificationActionAvailable = isQuickActionsNative;
