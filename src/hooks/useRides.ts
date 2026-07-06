/**
 * useRides — Sprint 3.
 *
 * Consome apenas rideService. Re-renderiza via eventBus em `rides:changed`.
 * Nunca importa storage/repository. Nunca faz polling.
 */
import { useMemo } from 'react';
import { rideService, type RideListFilters } from '@/lib/services/rideService';
import { useBusVersion } from './useBusVersion';

export function useRides(filters?: RideListFilters) {
  const v = useBusVersion('rides:changed');
  return useMemo(() => rideService.list(filters), [v, JSON.stringify(filters ?? {})]);
}

export function useRidesByShift(shiftId: string | null | undefined) {
  const v = useBusVersion('rides:changed');
  return useMemo(() => (shiftId ? rideService.listByShift(shiftId) : []), [v, shiftId]);
}

export function useRidesByDay(date: Date = new Date()) {
  const v = useBusVersion('rides:changed');
  const key = date.toDateString();
  return useMemo(() => rideService.listByDay(date), [v, key]);
}
