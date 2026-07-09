/**
 * useFinancial — Sprint 3.
 * Reage a `financial:changed`. Consome apenas financialService.
 */
import { useMemo } from 'react';
import { financialService, type ListFilters } from '@/lib/services/financialService';
import { useBusVersion } from './useBusVersion';

export function useFinancialEntries(filters?: ListFilters) {
  const v = useBusVersion('financial:changed');
  const filtersKey = JSON.stringify(filters ?? {});
  // eslint-disable-next-line react-hooks/exhaustive-deps -- filtersKey encodes filters; obj identity ignored
  return useMemo(() => financialService.list(filters), [v, filtersKey]);
}
