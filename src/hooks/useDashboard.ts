/**
 * useDashboard — Sprint 3.
 *
 * ÚNICA leitura autorizada ao Dashboard. Encapsula:
 *   - goals + settings + profile plan (leitura pontual)
 *   - snapshot do dia (metricsService)
 *   - turno ativo + totals (shiftService)
 *   - insights (max 3)
 *
 * Reage a `rides:changed`, `financial:changed`, `shift:changed`.
 * Dashboard passa a ser um componente extremamente fino.
 */
import { useMemo } from 'react';
import { goalsService } from '@/lib/services/goalsService';
import { settingsService } from '@/lib/services/settingsService';
import { metricsService, type Insight, type DashboardSnapshot } from '@/lib/services/metricsService';
import { shiftService, type Shift, type ShiftTotals } from '@/lib/services/shiftService';
import { useBusVersion } from './useBusVersion';

export interface DashboardData {
  goals: ReturnType<typeof goalsService.get>;
  settings: ReturnType<typeof settingsService.get>;
  snapshot: DashboardSnapshot;
  activeShift: Shift | null;
  shiftTotals: ShiftTotals | null;
  insights: Insight[];
}

export function useDashboard(refresh: number = 0): DashboardData {
  const r = useBusVersion('rides:changed');
  const f = useBusVersion('financial:changed');
  const s = useBusVersion('shift:changed');
  const dataV = r + f + s;

  const goals = useMemo(() => { void dataV; void refresh; return goalsService.get(); }, [dataV, refresh]);
  const settings = useMemo(() => { void dataV; void refresh; return settingsService.get(); }, [dataV, refresh]);
  const snapshot = useMemo(
    () => { void r; void f; void refresh; return metricsService.dashboardSnapshot(goals.daily); },
    [r, f, goals.daily, refresh],
  );
  const activeShift = useMemo(() => { void s; void refresh; return shiftService.getActive(); }, [s, refresh]);
  const shiftTotals = useMemo(
    () => (activeShift ? shiftService.getTotals(activeShift) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s, r, activeShift?.turno_id, activeShift?.status, refresh],
  );
  const insights = useMemo(
    () => { void r; void f; void refresh; return metricsService.insights(goals.daily); },
    [r, f, goals.daily, refresh],
  );

  return { goals, settings, snapshot, activeShift, shiftTotals, insights };
}
