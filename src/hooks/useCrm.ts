/**
 * useCrm — Sprint 6 · Fase 1.
 * Hook reativo (useSyncExternalStore via useBusVersion) para o CRM.
 * Recarrega o snapshot quando 'crm:changed' incrementa. Não usa polling.
 */
import { useCallback, useEffect, useState } from 'react';
import { crmService, type CrmSnapshot } from '@/lib/services/crmService';
import { useBusVersion } from './useBusVersion';

export interface UseCrmState {
  loading: boolean;
  error: string | null;
  snapshot: CrmSnapshot | null;
  refresh: () => void;
}

export function useCrm(): UseCrmState {
  const [snapshot, setSnapshot] = useState<CrmSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  useBusVersion('crm:changed'); // apenas para re-render em outros mounts

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snap = await crmService.loadSnapshot();
      setSnapshot(snap);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar CRM.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, reloadTick]);

  const refresh = useCallback(() => setReloadTick(t => t + 1), []);
  return { loading, error, snapshot, refresh };
}
