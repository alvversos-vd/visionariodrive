/**
 * NotificationActionService — Sprint 7 · Checkpoint 1.
 *
 * Tradutor entre o plugin nativo `VisionarioQuickActions` e as camadas
 * oficiais (Services + EventBus). Não persiste, não calcula, não acessa
 * Repositories/Storage/Supabase/CloudSync.
 *
 * Fase 1 (esta): apenas ciclo start/stop + updateContent reativo por
 * eventos do bus. Handlers de ação (register/finish/undo/auto) serão
 * ligados nos Checkpoints 2 e 3.
 */
import type { PluginListenerHandle } from '@capacitor/core';

import { eventBus } from '../eventBus';
import { shiftService, type Shift, type ShiftTotals } from './shiftService';
import { rideDetectionService } from './rideDetectionService';
import {
  quickActionsPlugin,
  isQuickActionsNative,
  type QuickActionEvent,
} from '../native/quickActionsPlugin';

type Unsub = () => void;

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
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

class NotificationActionServiceImpl {
  private attached = false;
  private busUnsubs: Unsub[] = [];
  private actionListener: PluginListenerHandle | null = null;
  private started = false;

  async attach(): Promise<void> {
    if (this.attached) return;
    this.attached = true;

    // Assinaturas do bus (reatividade — sem polling, sem timers).
    this.busUnsubs.push(
      eventBus.subscribe('shift:started', () => { void this.handleShiftStarted(); }),
      eventBus.subscribe('shift:finished', () => { void this.handleShiftFinished(); }),
      eventBus.subscribe('shift:changed', () => { void this.pushContent(); }),
      eventBus.subscribe('rides:changed', () => { void this.pushContent(); }),
      eventBus.subscribe('detection:changed', () => { void this.handleDetection(); }),
    );

    // Listener de ações do plugin — handlers reais entram no CP2/CP3.
    try {
      this.actionListener = await quickActionsPlugin.addListener('action', (e) => {
        this.onPluginAction(e);
      });
    } catch {
      this.actionListener = null;
    }

    // Estado inicial: se já existe turno ativo no boot, ligar a notificação.
    const active = shiftService.getActive();
    if (active) await this.handleShiftStarted();
  }

  async detach(): Promise<void> {
    if (!this.attached) return;
    this.attached = false;
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
    } catch { /* noop */ }
  }

  private async handleShiftFinished(): Promise<void> {
    if (!this.started) return;
    try { await quickActionsPlugin.stop(); } catch { /* noop */ }
    this.started = false;
  }

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

  private async handleDetection(): Promise<void> {
    if (!this.started) return;
    const pending = rideDetectionService.getPending();
    if (!pending) return;
    try {
      await quickActionsPlugin.showAutoRideCandidate({});
    } catch { /* noop */ }
  }

  private onPluginAction(_event: QuickActionEvent): void {
    // Checkpoint 1: handlers ainda não implementados.
    // CP2 liga: register → notification:register, finish → shiftService.endAtomic, undo → rideService.undoLastRide
    // CP3 liga: confirm-auto/edit-auto/discard-auto + telemetria.
  }
}

export const notificationActionService = new NotificationActionServiceImpl();

export const _notificationActionInternals = { buildContent, formatDuration };

export const notificationActionAvailable = isQuickActionsNative;
