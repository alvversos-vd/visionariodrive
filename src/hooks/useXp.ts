/**
 * useXp — hook reativo do XP. Reagir a 'xp:changed' e 'level-up' via bus.
 */
import { useMemo } from 'react';
import { useBusVersion } from './useBusVersion';
import { xpService, type XpProgress } from '@/lib/services/xpService';

export interface UseXpState {
  progress: XpProgress;
  totalXp: number;
}

export function useXp(): UseXpState {
  useBusVersion('xp:changed');
  useBusVersion('level-up');
  return useMemo(() => {
    const p = xpService.progress();
    return { progress: p, totalXp: p.totalXp };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xpService.get().totalXp]);
}
