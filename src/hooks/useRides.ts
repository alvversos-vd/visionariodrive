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
  const filtersKey = JSON.stringify(filters ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- filtersKey encodes filters; obj identity ignored
  return useMemo(() => rideService.list(filters), [v, filtersKey]);
}

export function useRidesByShift(shiftId: string | null | undefined) {
  const v = useBusVersion('rides:changed');
  return useMemo(() => { void v; return shiftId ? rideService.listByShift(shiftId) : []; }, [v, shiftId]);
}

export function useRidesByDay(date: Date = new Date()) {
  const v = useBusVersion('rides:changed');
  const key = date.toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- key encodes date; date obj identity intentionally ignored
  return useMemo(() => rideService.listByDay(date), [v, key]);
}
