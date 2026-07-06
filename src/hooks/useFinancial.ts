/**
 * useFinancial — Sprint 3.
 * Reage a `financial:changed`. Consome apenas financialService.
 */
import { useMemo } from 'react';
import { financialService, type ListFilters } from '@/lib/services/financialService';
import { useBusVersion } from './useBusVersion';

export function useFinancialEntries(filters?: ListFilters) {
  const v = useBusVersion('financial:changed');
  return useMemo(() => financialService.list(filters), [v, JSON.stringify(filters ?? {})]);
}
