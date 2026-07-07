/**
 * RideDetectionService — Sprint 4.
 *
 * Detecção automática de corridas a partir de fixes GPS já filtrados
 * pelo `useShiftTracker`. NÃO abre novo watcher e NÃO acessa storage.
 *
 * ─── Máquina de estados por turno ────────────────────────────────────────
 *   IDLE  ──(spd > startSpeedKmh)──▶ MOVING
 *   MOVING ──(spd ≤ stopSpeedKmh)──▶ STOPPING
 *   STOPPING ──(spd > startSpeedKmh)──▶ MOVING (mesma corrida)
 *   STOPPING ──(parado ≥ stopDurationSeconds)──▶ finaliza corrida
 *
 * ─── Fluxo de persistência ──────────────────────────────────────────────
 *   finaliza corrida → cria PendingRide (memória) + emite detection:changed
 *   pending timeout   → auto-confirm → rideService.addGpsRide
 *   user confirm      → rideService.addGpsRide
 *   user discard      → drop pending, incrementa gps_false_positive
 *
 * ─── Confidence score (0..100) ──────────────────────────────────────────
 *   distância    peso 30
 *   duração      peso 25
 *   velocidade   peso 20
 *   precisão GPS peso 15
 *   nº de fixes  peso 10
 *   Corridas < minConfidence são descartadas silenciosamente
 *   (contabilizadas em gps_detection para análise futura).
 *
 * ─── Falso negativo ─────────────────────────────────────────────────────
 *   Assina `rides:manual-registered`. Se uma sessão está em MOVING e
 *   soma > 100m quando o driver registra manualmente, conta como
 *   gps_false_negative (o detector deveria ter pegado).
 *
 * Zero acesso a storage. Zero regra de negócio própria (delega para
 * `rideService.addGpsRide`).
 */

import { eventBus } from '../eventBus';
import { getRideDetectionConfig, type RideDetectionConfig } from '../rideDetectionConfig';
import { rideService } from './rideService';
import { telemetry } from '../telemetry';

export interface DetectionFix {
  lat: number;
  lng: number;
  t: number;
  acc: number;
  spd?: number; // m/s
}

type DetState = 'idle' | 'moving' | 'stopping';

interface Session {
  shiftId: string;
  state: DetState;
  startedAt: number;
  lastFixAt: number;
  lastMovingAt: number;
  meters: number;
  fixes: number;
  speedSumKmh: number;
  accSum: number;
  lastFix?: DetectionFix;
  lastRideEndedAt: number;
}

export interface PendingRide {
  id: string;
  shiftId: string;
  distanceKm: number;
  durationMin: number;
  startedAt: string;
  endedAt: string;
  confidence: number;
  detectedAt: number;
}

const sessions = new Map<string, Session>();
let pending: PendingRide | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let manualBusUnsub: (() => void) | null = null;

function haversineMeters(a: DetectionFix, b: DetectionFix): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function newSession(shiftId: string, t: number): Session {
  return {
    shiftId, state: 'idle', startedAt: 0,
    lastFixAt: t, lastMovingAt: 0,
    meters: 0, fixes: 0, speedSumKmh: 0, accSum: 0,
    lastRideEndedAt: 0,
  };
}

function computeConfidence(s: Session, cfg: RideDetectionConfig, durationSec: number): number {
  const dScore   = Math.min(1, s.meters / (cfg.minRideMeters * 1.5)) * 30;
  const tScore   = Math.min(1, durationSec / (cfg.minRideSeconds * 1.5)) * 25;
  const avgSpeed = s.fixes > 0 ? s.speedSumKmh / s.fixes : 0;
  const spdScore = avgSpeed >= cfg.startSpeedKmh && avgSpeed <= cfg.maxSpeedKmh ? 20 : 0;
  const avgAcc   = s.fixes > 0 ? s.accSum / s.fixes : 999;
  const accScore = Math.max(0, (50 - Math.min(50, avgAcc)) / 50) * 15;
  const fixScore = Math.min(1, s.fixes / 20) * 10;
  return Math.round(dScore + tScore + spdScore + accScore + fixScore);
}

function clearPendingTimer(): void {
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
}

function ensureManualBusHook(): void {
  if (manualBusUnsub) return;
  manualBusUnsub = eventBus.subscribe('rides:manual-registered', () => {
    // Qualquer sessão em movimento com deslocamento acima de 100m
    // que perde para uma criação manual → sinaliza falso negativo.
    for (const s of sessions.values()) {
      if (s.state !== 'idle' && s.meters > 100) {
        telemetry.recordGps('gps_false_negative');
      }
      // Reset a sessão — a corrida atual "pertence" ao manual.
      s.state = 'idle';
      s.meters = 0; s.fixes = 0; s.speedSumKmh = 0; s.accSum = 0;
      s.lastRideEndedAt = Date.now();
    }
  });
}

function finalize(s: Session, cfg: RideDetectionConfig): void {
  const durationSec = Math.max(0, (s.lastMovingAt - s.startedAt) / 1000);
  const distMeters = s.meters;
  const confidence = computeConfidence(s, cfg, durationSec);
  const endedAtMs = s.lastMovingAt;

  // Registra tentativa (mesmo se descartada — permite ajuste futuro).
  telemetry.recordGps('gps_detection');

  // Reset da sessão preservando lastRideEndedAt para respeitar minGap.
  const startedAtMs = s.startedAt;
  s.state = 'idle';
  s.startedAt = 0;
  s.lastMovingAt = 0;
  s.meters = 0; s.fixes = 0; s.speedSumKmh = 0; s.accSum = 0;
  s.lastRideEndedAt = endedAtMs;

  if (distMeters < cfg.minRideMeters) return;
  if (durationSec < cfg.minRideSeconds) return;
  if (confidence < cfg.minConfidence) return;

  // Se já houver uma pending → descarta a nova (mantém a mais antiga).
  if (pending) return;

  pending = {
    id: crypto.randomUUID(),
    shiftId: s.shiftId,
    distanceKm: distMeters / 1000,
    durationMin: durationSec / 60,
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(endedAtMs).toISOString(),
    confidence,
    detectedAt: Date.now(),
  };
  eventBus.emit('detection:changed');

  clearPendingTimer();
  pendingTimer = setTimeout(
    () => { rideDetectionService.confirmPending(); },
    cfg.pendingTimeoutSeconds * 1000,
  );
}

export const rideDetectionService = {
  /** Chamado por useShiftTracker — apenas em modo automático. */
  ingest(shiftId: string, fix: DetectionFix): void {
    if (!shiftId) return;
    const cfg = getRideDetectionConfig();
    if (!cfg.enabled) return;
    ensureManualBusHook();

    let s = sessions.get(shiftId);
    if (!s) { s = newSession(shiftId, fix.t); sessions.set(shiftId, s); }

    const spdKmh = ((fix.spd ?? 0) * 3.6);
    const prev = s.lastFix;
    const delta = prev ? haversineMeters(prev, fix) : 0;
    s.lastFix = fix;
    s.lastFixAt = fix.t;

    // Sanity: velocidade impossível → ignora incremento (mas mantém estado).
    const boundedDelta = spdKmh > cfg.maxSpeedKmh ? 0 : delta;

    if (spdKmh > cfg.startSpeedKmh) {
      if (s.state === 'idle') {
        if (fix.t - s.lastRideEndedAt < cfg.minGapSeconds * 1000) return;
        s.state = 'moving';
        s.startedAt = fix.t;
        s.meters = 0;
        s.fixes = 1;
        s.speedSumKmh = spdKmh;
        s.accSum = fix.acc;
        s.lastMovingAt = fix.t;
      } else {
        s.meters += boundedDelta;
        s.fixes += 1;
        s.speedSumKmh += spdKmh;
        s.accSum += fix.acc;
        s.lastMovingAt = fix.t;
        if (s.state === 'stopping') s.state = 'moving';
      }
      return;
    }

    if (s.state === 'moving' || s.state === 'stopping') {
      s.meters += boundedDelta;
      s.fixes += 1;
      s.speedSumKmh += spdKmh;
      s.accSum += fix.acc;
    }

    if (spdKmh <= cfg.stopSpeedKmh) {
      if (s.state === 'moving') {
        s.state = 'stopping';
        // lastMovingAt fica no último tick de movimento real.
      } else if (s.state === 'stopping') {
        const stopFor = (fix.t - s.lastMovingAt) / 1000;
        if (stopFor >= cfg.stopDurationSeconds) finalize(s, cfg);
      }
    }
  },

  /** Reset da sessão do turno (fim de turno / pausa longa). */
  resetShift(shiftId: string): void {
    sessions.delete(shiftId);
    if (pending?.shiftId === shiftId) this.discardPending({ silent: true });
  },

  getPending(): PendingRide | null { return pending; },

  /**
   * Confirma a corrida pending, opcionalmente aplicando ajuste do driver.
   * Persistência definitiva via rideService.addGpsRide (RideRepository).
   */
  confirmPending(patch?: { value?: number; km?: number }): string | null {
    if (!pending) return null;
    clearPendingTimer();
    const p = pending;
    pending = null;

    const km = patch?.km ?? p.distanceKm;
    const value = Math.max(0, patch?.value ?? 0);
    const ride = rideService.addGpsRide({
      shiftId: p.shiftId,
      value,
      km,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
      kmOrigin: 'auto',
      date: p.endedAt,
    });
    telemetry.recordGps('gps_auto_saved');
    eventBus.emit('detection:changed');
    return ride.id;
  },

  /** Driver descarta a pending — false positive antes de persistir. */
  discardPending(opts: { silent?: boolean } = {}): void {
    if (!pending) return;
    pending = null;
    clearPendingTimer();
    if (!opts.silent) telemetry.recordGps('gps_false_positive');
    eventBus.emit('detection:changed');
  },

  /**
   * Driver desfaz uma corrida já salva (dentro da janela de undo do toast).
   * Remove via rideService e contabiliza como false_positive tardio.
   */
  undoConfirmed(rideId: string): boolean {
    if (!rideId) return false;
    rideService.deleteRide(rideId);
    telemetry.recordGps('gps_false_positive');
    // Ajuste da precisão: um auto_saved a menos.
    telemetry.recordGps('gps_auto_saved', -1);
    eventBus.emit('detection:changed');
    return true;
  },

  /** Estado interno (debug/audit). Não usar em UI de produção. */
  _debugState(): { sessions: Session[]; pending: PendingRide | null } {
    return { sessions: Array.from(sessions.values()), pending };
  },
};

export type RideDetectionService = typeof rideDetectionService;
