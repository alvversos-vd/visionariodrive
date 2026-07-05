/**
 * RideService — API canônica para corridas (Fase 2.3).
 *
 * DONO ÚNICO da escrita de RideModel. Nada mais grava corridas fora daqui.
 *
 * Fluxos:
 *   - saveManualRide  → RideAnalyzer (análise completa, gera analysis snapshot)
 *   - saveQuickRide   → captura rápida (valor + km, opcionalmente analisada)
 *   - addGpsRide      → chamado pelo módulo Shift/GPS ao registrar corrida
 *                       (captureMode='gps' — quando há tracking automático)
 *   - addRide/updateRide/deleteRide → API genérica sobre RideModel
 *
 * Fase 2.3 removeu completamente o mirror para o legacy RideEntry
 * (`lucro-delivery-rides`). Não existem mais espelhos ativos: a única
 * fonte de verdade de corridas persistidas é `vd-rides`.
 */

import { rideRepository, readAllRideModels } from '../repositories/rideRepository';
import { metricsService, type RideAnalysis } from './metricsService';
import type {
  RideModel,
  CaptureMode,
  RideApp,
  RideEarningsBreakdown,
  RideLocation,
  RideAnalysisSnapshot,
  RideGpsTrace,
} from '../domain/models';

// ─── Inputs ──────────────────────────────────────────────────────────────
export interface RideListFilters {
  captureMode?: CaptureMode | CaptureMode[];
  app?: RideApp;
  vehicleId?: string;
  shiftId?: string;
  from?: Date;
  to?: Date;
}

/** Input canônico de criação de corrida (usado por todos os fluxos). */
export interface RideInput {
  value: number;
  km: number;
  date?: string;                       // ISO — default: agora
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
}

/**
 * Input usado por RideAnalyzer (individual). Todos os campos de análise vivem
 * agora dentro do RideModel via `analysis`.
 */
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

/** Input do módulo Shift/GPS ao registrar uma corrida. */
export interface GpsRideInput extends RideInput {
  shiftId: string;
  /** 'auto' = km veio do GPS; 'manual' = usuário informou km */
  kmOrigin?: 'auto' | 'manual';
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
  };
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
    return this.list({ shiftId });
  },

  getById(id: string): RideModel | null {
    return rideRepository.getById(id) ?? readAllRideModels().find(r => r.id === id) ?? null;
  },

  countIndividual(): number {
    return this.list({ captureMode: ['manual', 'quick'] }).length;
  },

  // ---- Escrita canônica ------------------------------------------------
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

  /**
   * Fluxo Quick — captura rápida (valor + km). Se `analysis` não vier no
   * input, calcula on-the-fly via metricsService.
   */
  saveQuickRide(input: RideInput): RideModel {
    const analysis: RideAnalysisSnapshot = input.analysis ?? (() => {
      const a: RideAnalysis = metricsService.analyzeRide({ value: input.value, km: input.km });
      return { ...a };
    })();
    const ride = buildRide({ ...input, analysis }, 'quick');
    rideRepository.add(ride);
    return ride;
  },

  /**
   * Fluxo GPS — chamado pelo módulo Shift ao registrar uma corrida dentro
   * de um turno ativo. Persiste RideModel canônico em `vd-rides` com
   * captureMode='gps' (ou 'manual' quando o km foi informado pelo usuário
   * mesmo estando dentro do turno) e shiftId vinculado.
   *
   * Idempotente por id: se o caller já tem um id (ex.: corrida_id do turno),
   * pode reaproveitar via `input.notes`/service internos. Aqui geramos UUID
   * quando não vier — a camada Shift mantém sua chave interna independente.
   */
  addGpsRide(input: GpsRideInput): RideModel {
    const captureMode: CaptureMode = input.kmOrigin === 'manual' ? 'manual' : 'gps';
    // Analysis snapshot é útil para timeline/insights consumirem o
    // veredicto sem recomputar. Best-effort — não bloqueia se falhar.
    let analysis: RideAnalysisSnapshot | undefined = input.analysis;
    if (!analysis) {
      try {
        const a = metricsService.analyzeRide({ value: input.value, km: input.km });
        analysis = { ...a };
      } catch { /* base de custo indisponível — segue sem snapshot */ }
    }
    const ride = buildRide({ ...input, analysis }, captureMode);
    rideRepository.add(ride);
    return ride;
  },
};

export type RideService = typeof rideService;
