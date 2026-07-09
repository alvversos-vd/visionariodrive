/**
 * useMetrics / useInsights — Sprint 3.
 *
 * Reagem a rides:changed E financial:changed (métrica combina os dois).
 * MetricsService é a única API consumida.
 */
import { useMemo } from 'react';
import { metricsService, type Insight } from '@/lib/services/metricsService';
import { useBusVersion } from './useBusVersion';

function useDataVersion(): number {
  const r = useBusVersion('rides:changed');
  const f = useBusVersion('financial:changed');
  return r + f;
}

export function useDayMetrics(date: Date = new Date()) {
  const v = useDataVersion();
  const key = date.toDateString();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- key encodes date; date obj identity intentionally ignored
  return useMemo(() => { void v; return metricsService.dayMetrics(date); }, [v, key]);
}

export function useDashboardSnapshot(goalDaily: number) {
  const v = useDataVersion();
  return useMemo(() => { void v; return metricsService.dashboardSnapshot(goalDaily); }, [v, goalDaily]);
}

export function useInsights(goalDaily: number): Insight[] {
  const v = useDataVersion();
  return useMemo(() => { void v; return metricsService.insights(goalDaily); }, [v, goalDaily]);
}
