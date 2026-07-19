/**
 * RideService — API canônica para corridas (Fase 2.4).
 *
 * DONO ÚNICO da escrita de RideModel. Nada mais grava corridas fora daqui.
 *
 * Orquestração de corridas dentro de turnos (Shift):
 *   - registerShiftRide        → substitui shifts.addRide/addRideAuto
 *   - updateShiftRide          → substitui shifts.updateRide
 *   - deleteShiftRide          → substitui shifts.deleteRide
 *   - restoreShiftRide         → substitui shifts.restoreRide
 *   - revertLastShiftRideEdit  → substitui shifts.revertLastEdit
 *
 * Fluxos manuais/GPS/quick:
 *   - saveManualRide  → RideAnalyzer (análise completa, gera analysis snapshot)
 *   - saveQuickRide   → captura rápida (valor + km, opcionalmente analisada)
 *   - addGpsRide      → GPS puro (sem turno) — reservado
 *   - addRide/updateRide/deleteRide → API genérica sobre RideModel
 *
 * Fase 2.4 removeu completamente a escrita em `Shift.rides`. A única fonte
 * de verdade de corridas persistidas é `vd-rides`. `shifts.markRideRegistered`
 * é usado apenas para atualizar estado de SESSÃO do turno ativo
 * (`km_desde_ultima_corrida`, `ultima_corrida_iso`).
 */

import { rideRepository, readAllRideModels } from '../repositories/rideRepository';
import { metricsService, type RideAnalysis } from './metricsService';
import { classifyRide, getShifts, markRideRegistered, type Shift } from '../shifts';
import { eventBus } from '../eventBus';
import type { DailyEntry } from '../types';
import type {
  RideModel,
  CaptureMode,
  RideApp,
  RideEarningsBreakdown,
  RideLocation,
  RideAnalysisSnapshot,
  RideGpsTrace,
  RideEdit,
} from '../domain/models';
import {
  rideModelToShiftRide,
  resultadoToVerdict,
  type ShiftRide,
} from '../adapters/rideAdapters';

// ─── Inputs ──────────────────────────────────────────────────────────────
export interface RideListFilters {
  captureMode?: CaptureMode | CaptureMode[];
  app?: RideApp;
  vehicleId?: string;
  shiftId?: string;
  from?: Date;
  to?: Date;
}

export interface RideInput {
  value: number;
  km: number;
  date?: string;
  durationMin?: number;
  app?: RideApp;
  vehicleId?: string;
  vehicleName?: string;
  rideType?: string;
  notes?: string;
  analysis?: RideAnalysisSnapshot;
  startedAt?: string;
  endedAt?: string;
  startLocation?: RideLocation;
  endLocation?: RideLocation;
  earningsBreakdown?: RideEarningsBreakdown;
  shiftId?: string;
  gps?: RideGpsTrace;
  operationalDate?: string;
  kmOrigin?: 'auto' | 'manual';
}

export interface SaveIndividualInput {
  value: number;
  km: number;
  costPerKm: number;
  minIdealKm: number;
  ridePerKm: number;
  profit: number;
  verdict: 'good' | 'ok' | 'bad';
  vehicle?: string;
  rideType?: string;
}

export interface GpsRideInput extends RideInput {
  shiftId: string;
  kmOrigin?: 'auto' | 'manual';
}

/** Input canônico para registrar uma corrida dentro de um turno ativo. */
export interface RegisterShiftRideInput {
  shiftId: string;
  value: number;
  km: number;
  kmOrigin?: 'auto' | 'manual';
  observacao?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function inRange(iso: string, from?: Date, to?: Date): boolean {
  const t = new Date(iso).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date):   Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function findShift(shiftId: string): Shift | null {
  return getShifts().find(s => s.turno_id === shiftId) ?? null;
}

function buildRide(input: RideInput, captureMode: CaptureMode, id?: string): RideModel {
  return {
    id: id ?? crypto.randomUUID(),
    date: input.date ?? new Date().toISOString(),
    captureMode,
    value: Number(input.value) || 0,
    km: Number(input.km) || 0,
    durationMin: input.durationMin,
    app: input.app,
    vehicleId: input.vehicleId,
    vehicleName: input.vehicleName,
    rideType: input.rideType,
    notes: input.notes,
    analysis: input.analysis,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    startLocation: input.startLocation,
    endLocation: input.endLocation,
    earningsBreakdown: input.earningsBreakdown,
    shiftId: input.shiftId,
    gps: input.gps,
    operationalDate: input.operationalDate,
    kmOrigin: input.kmOrigin,
  };
}

function reclassify(shift: Shift | null, value: number, km: number): RideAnalysisSnapshot {
  if (shift) {
    const cls = classifyRide(value, km, shift);
    // Reaproveita cost/min do metrics para consistência
    let cpk = 0; let min = 0;
    try {
      const a = metricsService.analyzeRide({ value, km });
      cpk = a.costPerKm; min = a.minIdealKm;
    } catch { /* noop */ }
    return {
      costPerKm: cpk,
      minIdealKm: min,
      ridePerKm: cls.valor_por_km,
      profit: value - cpk * km,
      verdict: resultadoToVerdict(cls.resultado),
    };
  }
  const a = metricsService.analyzeRide({ value, km });
  return { ...a };
}

// ─── API pública ─────────────────────────────────────────────────────────
export const rideService = {
  // ---- Leitura ---------------------------------------------------------
  list(filters: RideListFilters = {}): RideModel[] {
    let rides = readAllRideModels();
    if (filters.captureMode) {
      const modes = Array.isArray(filters.captureMode) ? filters.captureMode : [filters.captureMode];
      rides = rides.filter(r => modes.includes(r.captureMode));
    }
    if (filters.app)       rides = rides.filter(r => r.app === filters.app);
    if (filters.vehicleId) rides = rides.filter(r => r.vehicleId === filters.vehicleId);
    if (filters.shiftId)   rides = rides.filter(r => r.shiftId === filters.shiftId);
    if (filters.from || filters.to) rides = rides.filter(r => inRange(r.date, filters.from, filters.to));
    return rides;
  },

  listByDay(date: Date = new Date()): RideModel[] {
    return this.list({ from: startOfDay(date), to: endOfDay(date) });
  },

  listByShift(shiftId: string): RideModel[] {
    return rideRepository.listByShift(shiftId);
  },

  groupByShift(): Map<string, RideModel[]> {
    return rideRepository.groupByShift();
  },

  getById(id: string): RideModel | null {
    return rideRepository.getById(id) ?? readAllRideModels().find(r => r.id === id) ?? null;
  },

  countIndividual(): number {
    return this.list({ captureMode: ['manual', 'quick'] }).length;
  },

  // ---- Escrita canônica genérica --------------------------------------
  addRide(input: RideInput, captureMode: CaptureMode = 'manual'): RideModel {
    const ride = buildRide(input, captureMode);
    rideRepository.add(ride);
    return ride;
  },

  updateRide(id: string, patch: Partial<RideModel>): RideModel | null {
    return rideRepository.update(id, patch);
  },

  deleteRide(id: string): void {
    rideRepository.remove(id);
  },

  // ---- Fluxos específicos ---------------------------------------------
  /**
   * Fluxo Manual — RideAnalyzer. Escreve RideModel canônico com analysis.
   */
  saveManualRide(input: SaveIndividualInput): RideModel {
    const ride = buildRide(
      {
        value: input.value,
        km: input.km,
        vehicleName: input.vehicle,
        rideType: input.rideType,
        notes: input.rideType,
        analysis: {
          costPerKm: input.costPerKm,
          minIdealKm: input.minIdealKm,
          ridePerKm: input.ridePerKm,
          profit: input.profit,
          verdict: input.verdict,
        },
      },
      'manual',
    );
    rideRepository.add(ride);
    return ride;
  },

  /** Fluxo Quick — captura rápida (valor + km). */
  saveQuickRide(input: RideInput): RideModel {
    const analysis: RideAnalysisSnapshot = input.analysis ?? (() => {
      const a: RideAnalysis = metricsService.analyzeRide({ value: input.value, km: input.km });
      return { ...a };
    })();
    const ride = buildRide({ ...input, analysis }, 'quick');
    rideRepository.add(ride);
    return ride;
  },

  /** Fluxo GPS puro (sem shift, reservado). */
  addGpsRide(input: GpsRideInput): RideModel {
    const captureMode: CaptureMode = input.kmOrigin === 'manual' ? 'manual' : 'gps';
    let analysis: RideAnalysisSnapshot | undefined = input.analysis;
    if (!analysis) {
      try {
        const a = metricsService.analyzeRide({ value: input.value, km: input.km });
        analysis = { ...a };
      } catch { /* noop */ }
    }
    const ride = buildRide({ ...input, analysis }, captureMode);
    rideRepository.add(ride);
    return ride;
  },

  // ─── Orquestração ShiftRide (Fase 2.4) ────────────────────────────────
  /**
   * Registra uma corrida dentro de um turno ativo.
   * Escreve exclusivamente em `vd-rides` (canônico) e atualiza estado de
   * SESSÃO do turno via `markRideRegistered` (sem tocar em Shift.rides).
   */
  registerShiftRide(input: RegisterShiftRideInput): RideModel | null {
    const shift = findShift(input.shiftId);
    if (!shift || shift.status !== 'ativo') return null;
    const value = Number(input.value) || 0;
    const km = Number(input.km) || 0;
    if (value <= 0 || km <= 0) return null;
    const dateIso = new Date().toISOString();
    const analysis = reclassify(shift, value, km);
    const ride: RideModel = buildRide(
      {
        value,
        km,
        date: dateIso,
        vehicleId: shift.veiculo_id,
        notes: input.observacao?.trim() || undefined,
        shiftId: shift.turno_id,
        operationalDate: shift.data_operacional,
        kmOrigin: input.kmOrigin,
        gps: shift.rota && shift.rota.length > 0 ? { points: shift.rota.length } : undefined,
        analysis,
      },
      input.kmOrigin === 'auto' ? 'gps' : 'manual',
    );
    rideRepository.add(ride);
    markRideRegistered(shift.turno_id, dateIso);
    // Sinaliza para o rideDetectionService que o driver registrou uma
    // corrida manual — permite computar gps_false_negative sem acoplar
    // este service ao detector (comunicação por evento).
    eventBus.emit('rides:manual-registered');
    return ride;
  },

  /**
   * Edita valor/km de uma corrida do turno, mantendo edit history no RideModel.
   */
  updateShiftRide(rideId: string, patch: { km?: number; valor?: number }): RideModel | null {
    const current = rideRepository.getById(rideId);
    if (!current) return null;
    const edits: RideEdit[] = current.edits ? [...current.edits] : [];
    const nowIso = new Date().toISOString();
    let originalKm = current.originalKm;
    let originalValue = current.originalValue;
    let km = current.km;
    let value = current.value;

    if (typeof patch.km === 'number' && Number.isFinite(patch.km) && patch.km > 0 && patch.km !== current.km) {
      if (originalKm === undefined) originalKm = current.km;
      edits.push({ field: 'km', from: current.km, to: patch.km, at: nowIso });
      km = patch.km;
    }
    if (typeof patch.valor === 'number' && Number.isFinite(patch.valor) && patch.valor > 0 && patch.valor !== current.value) {
      if (originalValue === undefined) originalValue = current.value;
      edits.push({ field: 'value', from: current.value, to: patch.valor, at: nowIso });
      value = patch.valor;
    }
    if (edits.length === (current.edits?.length ?? 0)) return current;

    const shift = current.shiftId ? findShift(current.shiftId) : null;
    const analysis = reclassify(shift, value, km);

    return rideRepository.update(rideId, {
      km, value, edits, originalKm, originalValue, analysis,
    });
  },

  /** Remove uma corrida do turno da fonte canônica. */
  deleteShiftRide(rideId: string): void {
    rideRepository.remove(rideId);
  },

  /**
   * Restaura uma corrida previamente deletada (usada pelo "Desfazer").
   * Recebe o snapshot no formato ShiftRide (UI) e o reinsere como RideModel.
   */
  restoreShiftRide(snapshot: ShiftRide): RideModel | null {
    if (!snapshot?.corrida_id) return null;
    const shift = snapshot.turno_id ? findShift(snapshot.turno_id) : null;
    const analysis = reclassify(shift, snapshot.valor, snapshot.km);
    const ride: RideModel = {
      id: snapshot.corrida_id,
      date: snapshot.data_registro,
      captureMode: snapshot.km_origem === 'auto' ? 'gps' : 'manual',
      value: snapshot.valor,
      km: snapshot.km,
      vehicleId: shift?.veiculo_id,
      notes: snapshot.observacao,
      shiftId: snapshot.turno_id || undefined,
      operationalDate: snapshot.data_operacional,
      kmOrigin: snapshot.km_origem,
      originalKm: snapshot.km_original,
      originalValue: snapshot.valor_original,
      analysis,
    };
    rideRepository.add(ride);
    return ride;
  },

  /**
   * Reverte a última edição registrada em uma corrida (km ou valor).
   * Não remove o edit history — anexa uma edição inversa.
   */
  revertLastShiftRideEdit(rideId: string): RideModel | null {
    const current = rideRepository.getById(rideId);
    if (!current || !current.edits || current.edits.length === 0) return null;
    const last = current.edits[current.edits.length - 1];
    const nowIso = new Date().toISOString();
    const edits: RideEdit[] = [...current.edits];
    let km = current.km;
    let value = current.value;

    if (last.field === 'km') {
      edits.push({ field: 'km', from: current.km, to: last.from, at: nowIso });
      km = last.from;
    } else {
      edits.push({ field: 'value', from: current.value, to: last.from, at: nowIso });
      value = last.from;
    }
    const shift = current.shiftId ? findShift(current.shiftId) : null;
    const analysis = reclassify(shift, value, km);
    return rideRepository.update(rideId, { km, value, edits, analysis });
  },

  /**
   * Sprint 7 — Desfaz a última corrida registrada (mais recente por `date`).
   * Reutiliza `deleteRide` (que delega a `rideRepository.remove` + emite
   * `rides:changed`). Não duplica lógica; apenas seleciona o alvo.
   * Retorna o id removido ou `null` se não havia corrida.
   */
  undoLastRide(): string | null {
    const all = readAllRideModels();
    if (all.length === 0) return null;
    const last = all.reduce((a, b) =>
      new Date(a.date).getTime() >= new Date(b.date).getTime() ? a : b,
    );
    this.deleteRide(last.id);
    return last.id;
  },



  // ─── DailyEntry legacy (Calculador Diário) ───────────────────────────
  // Fachada fina sobre o repository — componentes NUNCA importam o
  // repository. Marcado @deprecated: DailyEntry só existe até a
  // consolidação do Sprint 5 (DBT-L3).
  /** @deprecated DailyEntry legacy — remover junto com Calculador Diário. */
  listEntries(): DailyEntry[] { return rideRepository.listEntries(); },
  /** @deprecated DailyEntry legacy. */
  saveEntry(entry: DailyEntry): void { rideRepository.saveEntry(entry); },
  /** @deprecated DailyEntry legacy. */
  deleteEntry(id: string): void { rideRepository.deleteEntry(id); },
};

export type RideService = typeof rideService;
