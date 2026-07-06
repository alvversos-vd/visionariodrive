/**
 * ShiftService — Sprint 3.
 *
 * FACHADA pública oficial para tudo relacionado a Shift (turno / tracking).
 *
 * NENHUMA regra de negócio própria.
 * NENHUM cálculo próprio.
 * NENHUMA persistência própria.
 * NENHUM acesso direto a storage.
 *
 * Só delega para `src/lib/shifts.ts` (infra de sessão) e `rideService`
 * (fonte canônica de corridas). Componentes NÃO importam mais `shifts.ts`
 * — importam apenas `shiftService`. Fecha a exceção arquitetural do
 * ADR-004 (ver ADR-007).
 *
 * `shifts.ts` continua sendo a implementação (buffers de GPS, storage,
 * cloud sync, migração one-shot). Ele agora emite `shift:changed` em
 * toda mutação relevante para hooks se atualizarem sem polling.
 */

import * as shiftsInfra from '../shifts';
import type {
  Shift,
  ShiftRide,
  RideEdit,
  ShiftStatus,
  RideResult,
  ShiftPause,
  StartShiftOptions,
  ShiftTotals,
} from '../shifts';
import { rideService } from './rideService';
import { eventBus } from '../eventBus';

// ─── Re-export de tipos (única fonte pública) ────────────────────────────
export type {
  Shift, ShiftRide, RideEdit, ShiftStatus, RideResult,
  ShiftPause, StartShiftOptions, ShiftTotals,
};

// ─── Fachada canônica ────────────────────────────────────────────────────
export const shiftService = {
  // Leitura
  getActive(): Shift | null { return shiftsInfra.getActiveShift(); },
  list(): Shift[] { return shiftsInfra.getShifts(); },

  // Ciclo de vida
  start(opts: StartShiftOptions): Shift { return shiftsInfra.startShift(opts); },
  end(turnoId: string): Shift | null { return shiftsInfra.endShift(turnoId); },
  async endAtomic(turnoId: string): Promise<Shift | null> {
    return shiftsInfra.endShiftAtomic(turnoId);
  },
  pause(turnoId: string): Shift | null { return shiftsInfra.pauseShift(turnoId); },
  resume(turnoId: string): Shift | null { return shiftsInfra.resumeShift(turnoId); },
  remove(turnoId: string): boolean { return shiftsInfra.deleteShift(turnoId); },

  /**
   * getTotals — orquestra: busca corridas canônicas em rideService e
   * delega o cálculo puro para `shifts.computeTotals`. Zero lógica aqui.
   */
  getTotals(shift: Shift): ShiftTotals {
    const rides = rideService.listByShift(shift.turno_id);
    return shiftsInfra.computeTotals(shift, rides);
  },

  // Progresso de meta / classificação de corrida (reexport puro)
  metaProgresso(shift: Shift, lucro: number) {
    return shiftsInfra.metaProgresso(shift, lucro);
  },
  classifyRide(valor: number, km: number, shift?: Shift | null) {
    return shiftsInfra.classifyRide(valor, km, shift);
  },

  // ─── Tracking / GPS (delegação pura para infra) ────────────────────────
  appendRoutePoint: shiftsInfra.appendRoutePoint,
  addGpsDistance: shiftsInfra.addGpsDistance,
  flushBuffers: shiftsInfra.flushShiftBuffers,
  setGpsStatus: shiftsInfra.setShiftGpsStatus,
  clearRoute: shiftsInfra.clearShiftRoute,
  clearAllRoutes: shiftsInfra.clearAllRoutes,

  // ─── Formatação (reexport puro) ────────────────────────────────────────
  formatTempo: shiftsInfra.formatTempo,
  formatOperationalDate: shiftsInfra.formatOperationalDate,
  todayOperationalDate: shiftsInfra.todayOperationalDate,
  yesterdayOperationalDate: shiftsInfra.yesterdayOperationalDate,

  /**
   * subscribe — barramento oficial. Hooks (useShift, useDashboard) usam
   * isto para se reatualizar sem polling.
   */
  subscribe(cb: () => void): () => void {
    return eventBus.subscribe('shift:changed', cb);
  },
  getVersion(): number { return eventBus.getVersion('shift:changed'); },
};

export type ShiftService = typeof shiftService;
