/**
 * useCapabilities — Sprint 10.6.
 *
 * Leitura reativa da matriz de capacidades START × PRO.
 * Sem polling: a store notifica quando o plano muda (AuthContext).
 */
import { useSyncExternalStore } from 'react';
import {
  getCapabilities,
  subscribeCapabilities,
  type ProductCapabilities,
} from '@/lib/product/capabilities';

export function useCapabilities(): ProductCapabilities {
  return useSyncExternalStore(subscribeCapabilities, getCapabilities, getCapabilities);
}
