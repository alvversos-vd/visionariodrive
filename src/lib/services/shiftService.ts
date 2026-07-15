/**
 * ShiftService — Sprint 3, estendido na Sprint 6.
 *
 * FACHADA pública oficial para tudo relacionado a Shift (turno / tracking).
 *
 * Sprint 6: emite 'shift:started' / 'shift:finished' via bus, alimentando
 * a engine de gamificação sem alterar `shifts.ts` (que segue emitindo
 * `shift:changed` em qualquer mutação).
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

export type {
  Shift, ShiftRide, RideEdit, ShiftStatus, RideResult,
  ShiftPause, StartShiftOptions, ShiftTotals,
};

export const shiftService = {
  getActive(): Shift | null { return shiftsInfra.getActiveShift(); },
  list(): Shift[] { return shiftsInfra.getShifts(); },

  start(opts: StartShiftOptions): Shift {
    const s = shiftsInfra.startShift(opts);
    eventBus.emit('shift:started');
    return s;
  },
  end(turnoId: string): Shift | null {
    const s = shiftsInfra.endShift(turnoId);
    if (s) eventBus.emit('shift:finished');
    return s;
  },
  async endAtomic(turnoId: string): Promise<Shift | null> {
    const s = await shiftsInfra.endShiftAtomic(turnoId);
    if (s) eventBus.emit('shift:finished');
    return s;
  },
  pause(turnoId: string): Shift | null { return shiftsInfra.pauseShift(turnoId); },
  resume(turnoId: string): Shift | null { return shiftsInfra.resumeShift(turnoId); },
  remove(turnoId: string): boolean { return shiftsInfra.deleteShift(turnoId); },

  getTotals(shift: Shift): ShiftTotals {
    const rides = rideService.listByShift(shift.turno_id);
    return shiftsInfra.computeTotals(shift, rides);
  },

  metaProgresso(shift: Shift, lucro: number) {
    return shiftsInfra.metaProgresso(shift, lucro);
  },
  classifyRide(valor: number, km: number, shift?: Shift | null) {
    return shiftsInfra.classifyRide(valor, km, shift);
  },

  appendRoutePoint: shiftsInfra.appendRoutePoint,
  addGpsDistance: shiftsInfra.addGpsDistance,
  flushBuffers: shiftsInfra.flushShiftBuffers,
  setGpsStatus: shiftsInfra.setShiftGpsStatus,
  clearRoute: shiftsInfra.clearShiftRoute,
  clearAllRoutes: shiftsInfra.clearAllRoutes,

  formatTempo: shiftsInfra.formatTempo,
  formatOperationalDate: shiftsInfra.formatOperationalDate,
  todayOperationalDate: shiftsInfra.todayOperationalDate,
  yesterdayOperationalDate: shiftsInfra.yesterdayOperationalDate,

  subscribe(cb: () => void): () => void {
    return eventBus.subscribe('shift:changed', cb);
  },
  getVersion(): number { return eventBus.getVersion('shift:changed'); },
};

export type ShiftService = typeof shiftService;
