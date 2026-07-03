/**
 * RideService — API canônica para corridas (Fase 2.1).
 *
 * Todos os fluxos (manual, quick, GPS, importações futuras) convergem aqui.
 * Nenhum componente escreve corrida direto no repositório ou no storage.
 *
 * Nesta fase:
 *   - saveManualRide  → RideAnalyzer (individual)
 *   - saveQuickRide   → captura rápida (valor + km) — pronto para consumo
 *   - addRide/updateRide/removeRide → API genérica
 *   - list/listByDay/getById → leitura unificada via readAllRideModels
 *
 * Shift/GPS ainda escreve no formato legacy (migração acontece na Fase 2.2).
 *
 * Compat: `saveIndividual` mantido como wrapper deprecated que agora
 * delega em `saveManualRide` — os consumidores existentes (RideAnalyzer)
 * podem migrar sem risco. O legacy `RideEntry` continua sendo espelhado
 * em disco para que consumidores como `metricsService.recentIndividualRides`
 * e `ShiftHistoryView` não quebrem.
 */

import { rideRepository, readAllRideModels } from '../repositories/rideRepository';
import type {
  RideModel,
  CaptureMode,
  RideApp,
  RideEarningsBreakdown,
  RideLocation,
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
  notes?: string;
  startedAt?: string;
  endedAt?: string;
  startLocation?: RideLocation;
  endLocation?: RideLocation;
  earningsBreakdown?: RideEarningsBreakdown;
  shiftId?: string;
}

/**
 * Input usado por RideAnalyzer (individual). Aceita metadados de análise
 * que hoje ainda são espelhados no legacy `RideEntry` para preservar o
 * histórico "corridas recentes" enquanto Fase 2.2 não migrar o consumidor.
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
    notes: input.notes,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    startLocation: input.startLocation,
    endLocation: input.endLocation,
    earningsBreakdown: input.earningsBreakdown,
    shiftId: input.shiftId,
  };
}

/**
 * Espelha no legacy `RideEntry` (chave `lucro-delivery-rides`) para preservar
 * consumidores ainda não migrados (metricsService.recentIndividualRides,
 * ShiftHistoryView de corridas avulsas, telas de exportação legacy).
 *
 * A remoção deste mirror está na fila da Fase 2.2, junto com os consumidores.
 */
function mirrorToLegacyRideEntry(ride: RideModel, extra?: Partial<RideEntry>): void {
  const legacy: RideEntry = {
    id: ride.id,
    date: ride.date,
    value: ride.value,
    km: ride.km,
    costPerKm: extra?.costPerKm ?? 0,
    minIdealKm: extra?.minIdealKm ?? 0,
    ridePerKm: extra?.ridePerKm ?? (ride.km > 0 ? ride.value / ride.km : 0),
    profit: extra?.profit ?? 0,
    verdict: extra?.verdict ?? 'ok',
    vehicle: extra?.vehicle,
    rideType: extra?.rideType ?? ride.notes,
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
    return rideRepository.add(ride);
  },

  updateRide(id: string, patch: Partial<RideModel>): RideModel | null {
    return rideRepository.update(id, patch);
  },

  deleteRide(id: string): void {
    rideRepository.remove(id);
    // Espelho legacy: se existir no `lucro-delivery-rides`, remover também.
    try { rideRepository.deleteRide(id); } catch { /* noop */ }
  },

  /**
   * Fluxo Manual — corrida individual analisada (RideAnalyzer).
   * Escreve RideModel canônico + espelha em legacy RideEntry.
   */
  saveManualRide(input: SaveIndividualInput): RideModel {
    const ride = buildRide(
      {
        value: input.value,
        km: input.km,
        vehicleId: undefined,
        notes: input.rideType,
      },
      'manual',
    );
    rideRepository.add(ride);
    mirrorToLegacyRideEntry(ride, {
      costPerKm: input.costPerKm,
      minIdealKm: input.minIdealKm,
      ridePerKm: input.ridePerKm,
      profit: input.profit,
      verdict: input.verdict,
      vehicle: input.vehicle,
      rideType: input.rideType,
    });
    return ride;
  },

  /**
   * Fluxo Quick — captura rápida (valor + km) sem análise pesada.
   * Mesmo Repository, mesmo formato — apenas `captureMode='quick'`.
   */
  saveQuickRide(input: RideInput): RideModel {
    const ride = buildRide(input, 'quick');
    rideRepository.add(ride);
    mirrorToLegacyRideEntry(ride);
    return ride;
  },

  /**
   * @deprecated Usar `saveManualRide`. Wrapper mantido para consumidores
   * que ainda não migraram — delega no fluxo canônico.
   */
  saveIndividual(input: SaveIndividualInput): RideModel {
    return this.saveManualRide(input);
  },
};

export type RideService = typeof rideService;
