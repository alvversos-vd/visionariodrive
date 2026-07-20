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
import { rideService } from './rideService';
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

/** Janela em ms para associar um `rides:manual-registered` ao clique
 *  "Registrar" da notificação — usada apenas para disparar o showUndo
 *  nativo (o timer de 10s vive no plugin Android). */
const UNDO_ARM_WINDOW_MS = 90_000;

const BRL_SHORT = new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
});

class NotificationActionServiceImpl {
  private attached = false;
  private busUnsubs: Unsub[] = [];
  private actionListener: PluginListenerHandle | null = null;
  private started = false;

  // Armamento do Undo: quando o driver toca "Registrar" na notificação,
  // esperamos até UNDO_ARM_WINDOW_MS por um rides:manual-registered
  // antes de mostrar o botão Desfazer (10s de janela no plugin nativo).
  private undoArmedUntil = 0;

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
    } catch { /* noop */ }
  }

  private async handleShiftFinished(): Promise<void> {
    this.undoArmedUntil = 0;
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

  private async handleDetection(): Promise<void> {
    if (!this.started) return;
    const pending = rideDetectionService.getPending();
    if (!pending) return;
    try {
      await quickActionsPlugin.showAutoRideCandidate({});
    } catch { /* noop */ }
  }

  // ─── Ações vindas do plugin (transporte → Services) ───────────────
  private async onPluginAction(event: QuickActionEvent): Promise<void> {
    switch (event.type) {
      case 'register': {
        // Arma o Undo — o BottomSheet React existente cuidará da criação.
        this.undoArmedUntil = Date.now() + UNDO_ARM_WINDOW_MS;
        eventBus.emit('notification:register');
        return;
      }
      case 'finish': {
        const active = shiftService.getActive();
        if (!active) return;
        try { await shiftService.endAtomic(active.turno_id); } catch { /* noop */ }
        return;
      }
      case 'undo': {
        try { rideService.undoLastRide(); } catch { /* noop */ }
        // Nada de updateContent manual — rides:changed já dispara pushContent.
        try { await quickActionsPlugin.hideUndo(); } catch { /* noop */ }
        return;
      }
      // Checkpoint 3 — Auto Ride
      case 'confirm-auto':
      case 'edit-auto':
      case 'discard-auto':
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

export const _notificationActionInternals = { buildContent, formatDuration };

export const notificationActionAvailable = isQuickActionsNative;
