/**
 * useBusVersion — Sprint 3.
 * Wrapper genérico sobre useSyncExternalStore + eventBus.
 * Snapshot = número monotônico. Componentes reagem sem polling.
 */
import { useSyncExternalStore } from 'react';
import { eventBus, type BusEvent } from '@/lib/eventBus';

export function useBusVersion(evt: BusEvent): number {
  return useSyncExternalStore(
    (cb) => eventBus.subscribe(evt, cb),
    () => eventBus.getVersion(evt),
    () => 0,
  );
}
