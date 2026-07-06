/**
 * useShift — Sprint 3.
 *
 * Reage a `shift:changed` via shiftService.subscribe. Zero polling.
 * Componentes de tracking consomem exclusivamente isto.
 */
import { useMemo } from 'react';
import { shiftService, type Shift, type ShiftTotals } from '@/lib/services/shiftService';
import { useBusVersion } from './useBusVersion';

export function useActiveShift(): Shift | null {
  const v = useBusVersion('shift:changed');
  return useMemo(() => shiftService.getActive(), [v]);
}

export function useShifts(): Shift[] {
  const v = useBusVersion('shift:changed');
  return useMemo(() => shiftService.list(), [v]);
}

/** Totals já orquestrados (rides + shift). Reativo a rides:changed também. */
export function useShiftTotals(shift: Shift | null | undefined): ShiftTotals | null {
  const sv = useBusVersion('shift:changed');
  const rv = useBusVersion('rides:changed');
  return useMemo(
    () => (shift ? shiftService.getTotals(shift) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sv, rv, shift?.turno_id, shift?.status],
  );
}
