/**
 * RideService — leitura unificada de corridas via RideModel.
 *
 * Nesta sprint (1.5) é um ADAPTER SOMENTE-LEITURA sobre:
 *   - RideEntry (FAB → storage.rides)
 *   - Shift.rides (turno GPS/manual)
 *   - DailyEntry (agregado diário — exposto como captureMode='imported')
 *
 * Escrita de RideModel não existe ainda; entrará na Fase 2, sem quebrar
 * consumidores porque o contrato de leitura já é o final.
 *
 * Consome APENAS rideRepository.
 */

import { rideRepository, readAllRideModels } from '../repositories/rideRepository';
import type { RideModel, CaptureMode, RideApp } from '../domain/models';

export interface RideListFilters {
  captureMode?: CaptureMode | CaptureMode[];
  app?: RideApp;
  vehicleId?: string;
  from?: Date;
  to?: Date;
}

const NOT_IMPLEMENTED = (method: string): never => {
  throw new Error(`RideService.${method} — write API entra na Fase 2.`);
};

function inRange(iso: string, from?: Date, to?: Date): boolean {
  const t = new Date(iso).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }

export const rideService = {
  list(filters: RideListFilters = {}): RideModel[] {
    let rides = readAllRideModels();
    if (filters.captureMode) {
      const modes = Array.isArray(filters.captureMode) ? filters.captureMode : [filters.captureMode];
      rides = rides.filter(r => modes.includes(r.captureMode));
    }
    if (filters.app)      rides = rides.filter(r => r.app === filters.app);
    if (filters.vehicleId) rides = rides.filter(r => r.vehicleId === filters.vehicleId);
    if (filters.from || filters.to) rides = rides.filter(r => inRange(r.date, filters.from, filters.to));
    return rides;
  },

  listByDay(date: Date = new Date()): RideModel[] {
    return this.list({ from: startOfDay(date), to: endOfDay(date) });
  },

  getById(id: string): RideModel | null {
    return readAllRideModels().find(r => r.id === id) ?? null;
  },

  countIndividual(): number {
    // Corridas individuais (não `imported`) — usadas em micro-wins/onboarding.
    return rideRepository.listRides().length;
  },

  // Contrato final — implementação na Fase 2
  add(): RideModel { return NOT_IMPLEMENTED('add'); },
  remove(): void { return NOT_IMPLEMENTED('remove'); },
};

export type RideService = typeof rideService;
