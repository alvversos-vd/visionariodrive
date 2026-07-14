/**
 * eventBus — Sprint 3 / estendido na Sprint 4.
 *
 * Barramento local ultra-simples usado por Services para notificar hooks
 * (useSyncExternalStore). NÃO é fonte de verdade e NÃO carrega payload.
 * Apenas sinaliza "algo mudou nesta categoria — releia via Service".
 *
 * Eventos oficiais (fechados):
 *   - rides:changed            → mutação em qualquer RideModel
 *   - financial:changed        → mutação em FinancialEntry
 *   - shift:changed            → mutação em Shift (start/pause/end/tracking)
 *   - detection:changed        → transição do rideDetectionService (Sprint 4)
 *   - rides:manual-registered  → sinal para detector zerar sessão / contar
 *                                falsos negativos (Sprint 4)
 *
 * Regras:
 *   - Nenhum componente publica eventos. Apenas Services.
 *   - Nenhum evento carrega dados sensíveis.
 */

export type BusEvent =
  | 'rides:changed'
  | 'financial:changed'
  | 'shift:changed'
  | 'detection:changed'
  | 'rides:manual-registered'
  // Sprint 6 — CRM + Gamification + Invites
  | 'crm:changed'
  | 'xp:changed'
  | 'achievement:unlocked'
  | 'profile:changed'
  | 'invite:changed';

type Listener = () => void;
const listeners: Record<BusEvent, Set<Listener>> = {
  'rides:changed': new Set(),
  'financial:changed': new Set(),
  'shift:changed': new Set(),
  'detection:changed': new Set(),
  'rides:manual-registered': new Set(),
  'crm:changed': new Set(),
  'xp:changed': new Set(),
  'achievement:unlocked': new Set(),
  'profile:changed': new Set(),
  'invite:changed': new Set(),
};

const version: Record<BusEvent, number> = {
  'rides:changed': 0,
  'financial:changed': 0,
  'shift:changed': 0,
  'detection:changed': 0,
  'rides:manual-registered': 0,
  'crm:changed': 0,
  'xp:changed': 0,
  'achievement:unlocked': 0,
  'profile:changed': 0,
  'invite:changed': 0,
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
  getVersion(evt: BusEvent): number { return version[evt]; },
};
