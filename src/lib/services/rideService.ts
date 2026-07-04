/**
 * RideService — API canônica para corridas (Fase 2.2).
 *
 * Toda leitura e toda escrita de corridas passa aqui. Nenhum componente
 * escreve ou lê `RideEntry` legacy diretamente — o mirror abaixo é apenas
 * uma rede de rollback e não deve ser consumido em nenhum lugar novo.
 *
 * Fluxos:
 *   - saveManualRide  → RideAnalyzer (análise completa, gera analysis snapshot)
 *   - saveQuickRide   → captura rápida (valor + km, opcionalmente analisada)
 *   - addRide/updateRide/deleteRide → API genérica sobre RideModel
 *   - addGpsRide      → contrato reservado para Fase 2.3 (GPS)
 *
 * Shift/GPS ainda escreve no formato legacy do módulo shifts (raíz de
 * tracking — migra na Fase 2.3 sem alterar RideService).
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
} from '../domain/models';
import type { RideEntry } from '../types';

// ─── Inputs ──────────────────────────────────────────────────────────────
export interface RideListFilters {
  captureMode?: CaptureMode | CaptureMode[];
  app?: RideApp;
  vehicleId?: string;
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
}

/**
 * Input usado por RideAnalyzer (individual). Todos os campos de análise vivem
 * agora dentro do RideModel via `analysis` — sem depender de RideEntry.
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

// ─── Helpers ─────────────────────────────────────────────────────────────
function inRange(iso: string, from?: Date, to?: Date): boolean {
  const t = new Date(iso).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}
function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date):   Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function buildRide(input: RideInput, captureMode: CaptureMode): RideModel {
  return {
    id: crypto.randomUUID(),
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
  };
}

/**
 * LEGACY MIRROR — REMOVE AFTER PHASE 3 STABLE.
 *
 * Espelha no legacy `RideEntry` (chave `lucro-delivery-rides`) apenas para
 * suportar rollback. NENHUM componente/serviço deve LER este mirror; toda
 * leitura passa por `rideService.list()` (RideModel).
 */
function mirrorToLegacyRideEntry(ride: RideModel): void {
  const a = ride.analysis;
  const legacy: RideEntry = {
    id: ride.id,
    date: ride.date,
    value: ride.value,
    km: ride.km,
    costPerKm: a?.costPerKm ?? 0,
    minIdealKm: a?.minIdealKm ?? 0,
    ridePerKm: a?.ridePerKm ?? (ride.km > 0 ? ride.value / ride.km : 0),
    profit: a?.profit ?? 0,
    verdict: a?.verdict ?? 'ok',
    vehicle: ride.vehicleName,
    rideType: ride.rideType ?? ride.notes,
  };
  try { rideRepository.saveRide(legacy); } catch { /* mirror best-effort */ }
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
    if (filters.from || filters.to) rides = rides.filter(r => inRange(r.date, filters.from, filters.to));
    return rides;
  },

  listByDay(date: Date = new Date()): RideModel[] {
    return this.list({ from: startOfDay(date), to: endOfDay(date) });
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
    mirrorToLegacyRideEntry(ride);
    return ride;
  },

  updateRide(id: string, patch: Partial<RideModel>): RideModel | null {
    return rideRepository.update(id, patch);
  },

  deleteRide(id: string): void {
    rideRepository.remove(id);
    // LEGACY MIRROR — REMOVE AFTER PHASE 3 STABLE.
    try { rideRepository.deleteRide(id); } catch { /* noop */ }
  },

  /**
   * Fluxo Manual — RideAnalyzer. Escreve RideModel canônico (com analysis)
   * e espelha em legacy RideEntry apenas para rollback.
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
    mirrorToLegacyRideEntry(ride);
    return ride;
  },

  /**
   * Fluxo Quick — captura rápida (valor + km). Se `analysis` não vier no
   * input, o service calcula on-the-fly via metricsService para garantir
   * verdict/costPerKm consistentes com a base do dia.
   */
  saveQuickRide(input: RideInput): RideModel {
    const analysis: RideAnalysisSnapshot = input.analysis ?? (() => {
      const a: RideAnalysis = metricsService.analyzeRide({ value: input.value, km: input.km });
      return { ...a };
    })();
    const ride = buildRide({ ...input, analysis }, 'quick');
    rideRepository.add(ride);
    mirrorToLegacyRideEntry(ride);
    return ride;
  },

  /**
   * Contrato reservado para Fase 2.3 — GPS. Nenhum consumidor deve chamar
   * ainda; o módulo Shift/GPS migrará para este método sem alterar a UX.
   */
  addGpsRide(_input: RideInput): RideModel {
    throw new Error('NOT_IMPLEMENTED: addGpsRide chega na Fase 2.3');
  },
};

export type RideService = typeof rideService;
