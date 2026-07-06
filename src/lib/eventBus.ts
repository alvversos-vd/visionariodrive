/**
 * eventBus — Sprint 3.
 *
 * Barramento local ultra-simples usado por Services para notificar hooks
 * (useSyncExternalStore). NÃO é fonte de verdade e NÃO carrega payload.
 * Apenas sinaliza "algo mudou nesta categoria — releia via Service".
 *
 * Eventos oficiais (fechados):
 *   - rides:changed
 *   - financial:changed
 *   - shift:changed
 *
 * Regras:
 *   - Nenhum componente publica eventos. Apenas Services.
 *   - Nenhum evento carrega dados sensíveis.
 */

export type BusEvent = 'rides:changed' | 'financial:changed' | 'shift:changed';

type Listener = () => void;
const listeners: Record<BusEvent, Set<Listener>> = {
  'rides:changed': new Set(),
  'financial:changed': new Set(),
  'shift:changed': new Set(),
};

// Versão monotônica por evento — snapshot para useSyncExternalStore.
const version: Record<BusEvent, number> = {
  'rides:changed': 0,
  'financial:changed': 0,
  'shift:changed': 0,
};

export const eventBus = {
  emit(evt: BusEvent): void {
    version[evt] += 1;
    for (const l of listeners[evt]) {
      try { l(); } catch { /* isolar handler quebrado */ }
    }
  },
  subscribe(evt: BusEvent, cb: Listener): () => void {
    listeners[evt].add(cb);
    return () => { listeners[evt].delete(cb); };
  },
  /** Snapshot inteiro (numérico) — barato o suficiente para useSyncExternalStore. */
  getVersion(evt: BusEvent): number { return version[evt]; },
};
