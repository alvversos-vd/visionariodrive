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
  type QuickRideFormPayload,
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

/**
 * Sprint 10.4.8 — parser do RemoteInput da notificação.
 * Adapter de ENTRADA puro: converte o texto digitado na central de
 * notificações em campos. Nenhuma regra de negócio aqui — validação e
 * persistência continuam exclusivamente no RideService.
 *
 * Formatos aceitos: "18,50 6,2 centro" · "R$18,50 6.2km" · "18,50" (km do GPS).
 */
/**
 * Chave de idempotência determinística para capturas nativas sem requestId
 * próprio: mesmo turno + mesmo texto dentro da mesma janela de 30s =
 * mesma intenção (replay de broadcast, double-tap no botão).
 */
function buildRequestId(shiftId: string, raw: string): string {
  const bucket = Math.floor(Date.now() / 30_000);
  let hash = 0;
  for (let i = 0; i < raw.length; i++) hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  return `notif:${shiftId}:${bucket}:${hash}`;
}

/**
 * ADR-015 — única tradução autorizada do contrato nativo para o domínio.
 * A fronteira nativa fala `kmSource` (quem preencheu); o domínio fala
 * `kmOrigin` (o que aquilo significa).
 */
export function toKmOrigin(kmSource: 'user' | 'prefilled'): 'auto' | 'manual' {
  return kmSource === 'prefilled' ? 'auto' : 'manual';
}

export function parseQuickRideInput(raw: string): {
  value: number | null; km: number | null; notes?: string;
} {
  const tokens = raw.trim().split(/[\s;,|]*\s+/).filter(Boolean);
  const nums: number[] = [];
  const rest: string[] = [];
  for (const tk of tokens) {
    if (nums.length < 2) {
      const cleaned = tk.replace(/r\$/i, '').replace(/km$/i, '').replace(',', '.');
      const n = Number.parseFloat(cleaned);
      if (Number.isFinite(n) && /^[\d.,]/.test(cleaned)) { nums.push(n); continue; }
    }
    rest.push(tk);
  }
  return {
    value: nums.length > 0 ? nums[0] : null,
    km: nums.length > 1 ? nums[1] : null,
    notes: rest.join(' ').trim() || undefined,
  };
}

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

    // LIM-001: o Bridge pode ter carregado (host invisível ou MainActivity)
    // antes deste listener existir. Pede a reentrega da fila durável.
    try { await quickActionsPlugin.flushPending(); } catch { /* noop */ }

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
      try { await quickActionsPlugin.showAutoRideCandidate({ resumo: buildAutoLabel(pending) }); }
      catch { /* noop */ }
      return;
    }
    // Sem pending → esconde candidato.
    if (this.lastPendingId !== null) {
      this.lastPendingId = null;
      try { await quickActionsPlugin.hideAutoRideCandidate(); } catch { /* noop */ }
    }
  }

  // ─── Registro inline pela notificação (Sprint 10.4.8) ─────────────
  /**
   * Entrada alternativa para o MESMO fluxo oficial de registro manual
   * (`rideService.registerShiftRide`). Nenhuma persistência, cálculo ou
   * validação vive aqui — apenas tradução texto → parâmetros do Service.
   *
   * Sprint 10.4.9: envia `clientRequestId` para que replay de broadcast
   * nativo (Android redeliver / fila PENDING do plugin) jamais duplique.
   */
  private async handleInlineRegister(raw: string, requestId?: string): Promise<void> {
    const active = shiftService.getActive();
    if (!active) {
      await this.toast('Nenhum turno ativo');
      return;
    }
    const parsed = parseQuickRideInput(raw);
    const kmAuto = active.km_desde_ultima_corrida || 0;
    const useAuto = parsed.km === null && active.gps_status === 'ok' && kmAuto > 0;
    const km = parsed.km ?? (useAuto ? kmAuto : 0);
    if (!parsed.value || parsed.value <= 0 || !km || km <= 0) {
      await this.toast('Formato inválido. Ex: 18,50 6,2 centro');
      return;
    }

    this.undoArmedUntil = Date.now() + UNDO_ARM_WINDOW_MS;
    let ride: ReturnType<typeof rideService.registerShiftRide> = null;
    try {
      ride = rideService.registerShiftRide({
        shiftId: active.turno_id,
        value: parsed.value,
        km,
        kmOrigin: useAuto ? 'auto' : 'manual',
        observacao: parsed.notes,
        clientRequestId: requestId ?? buildRequestId(active.turno_id, raw),
      });
    } catch { ride = null; }

    if (!ride) {
      this.undoArmedUntil = 0;
      await this.toast('Não foi possível salvar a corrida');
      return;
    }
    telemetry.recordNotification('notification_register');
    await this.toast(`✔ Corrida registrada · ${BRL.format(ride.value)} · ${ride.km.toFixed(1)} km`);
  }

  // ─── Quick Form nativo (ADR-015) ──────────────────────────────────
  /**
   * ADR-015 — a Activity entrega apenas `{ value, km, kmSource,
   * clientRequestId }`. Ela não conhece GPS e não decide `kmOrigin` nem
   * `captureMode`. A tradução do contrato nativo para o domínio acontece
   * exclusivamente aqui:
   *
   *   kmSource = 'user'      → kmOrigin = 'manual' → captureMode = 'manual'
   *   kmSource = 'prefilled' → kmOrigin = 'auto'   → captureMode = 'gps'
   *
   * Mesmo pipeline oficial: rideService.registerShiftRide → rideRepository
   * → outbox → cloudSync → eventBus. Nenhum caminho paralelo.
   */
  private async handleQuickFormRegister(form: QuickRideFormPayload): Promise<void> {
    const requestId = form.clientRequestId;
    const active = shiftService.getActive();
    if (!active) {
      await this.ack(requestId);
      await this.toast('Nenhum turno ativo');
      return;
    }
    const value = Number(form.value);
    const km = Number(form.km);
    if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(km) || km <= 0) {
      await this.ack(requestId);
      await this.toast('Valor e KM precisam ser maiores que zero');
      return;
    }

    this.undoArmedUntil = Date.now() + UNDO_ARM_WINDOW_MS;
    let ride: ReturnType<typeof rideService.registerShiftRide> = null;
    try {
      ride = rideService.registerShiftRide({
        shiftId: active.turno_id,
        value,
        km,
        kmOrigin: toKmOrigin(form.kmSource),
        observacao: form.notes?.trim() || undefined,
        clientRequestId: requestId
          || buildRequestId(active.turno_id, `${value}|${km}|${form.kmSource}`),
      });
    } catch { ride = null; }

    if (!ride) {
      this.undoArmedUntil = 0;
      // Sem ack: a intenção continua na fila durável para nova tentativa.
      await this.toast('Não foi possível salvar a corrida');
      return;
    }
    // Pipeline oficial aceitou → a intenção sai da fila de transporte.
    await this.ack(requestId);
    telemetry.recordNotification('notification_register');
    await this.toast(`✔ Corrida registrada · ${BRL.format(ride.value)} · ${ride.km.toFixed(1)} km`);
  }

  /** Confirma ao nativo que a intenção foi consumida pelo pipeline oficial. */
  private async ack(clientRequestId?: string): Promise<void> {
    if (!clientRequestId) return;
    try { await quickActionsPlugin.ackQuickForm({ clientRequestId }); } catch { /* noop */ }
  }

  private async toast(message: string): Promise<void> {
    try { await quickActionsPlugin.showToast({ message }); } catch { /* noop */ }
  }

  // ─── Ações vindas do plugin (transporte → Services) ───────────────
  private async onPluginAction(event: QuickActionEvent): Promise<void> {
    switch (event.type) {
      case 'register': {
        if (event.form) { await this.handleQuickFormRegister(event.form); return; }
        const raw = typeof event.raw === 'string' ? event.raw.trim() : '';
        if (raw) { await this.handleInlineRegister(raw, event.requestId); return; }
        // Sem RemoteInput (device sem inline reply) → modal React oficial.
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

export const _notificationActionInternals = { buildContent, formatDuration, buildAutoLabel, parseQuickRideInput, toKmOrigin };

export const notificationActionAvailable = isQuickActionsNative;
