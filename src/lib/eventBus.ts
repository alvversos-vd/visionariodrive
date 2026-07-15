/**
 * eventBus — Sprint 3 / estendido nas Sprints 4 e 6.
 *
 * Barramento local ultra-simples usado por Services para notificar hooks
 * (useSyncExternalStore). NÃO é fonte de verdade e NÃO carrega payload.
 * Apenas sinaliza "algo mudou nesta categoria — releia via Service".
 *
 * Regras:
 *   - Nenhum componente publica eventos. Apenas Services.
 *   - Nenhum evento carrega dados sensíveis.
 */

export type BusEvent =
  | 'rides:changed'
  | 'rides:manual-registered'
  | 'financial:changed'
  | 'shift:changed'
  | 'shift:started'
  | 'shift:finished'
  | 'goals:changed'
  | 'detection:changed'
  // Sprint 6 — CRM + Gamification + Invites
  | 'crm:changed'
  | 'xp:changed'
  | 'xp:earned'
  | 'level-up'
  | 'achievement:unlocked'
  | 'profile:changed'
  | 'invite:changed';

type Listener = () => void;

const EVENTS: BusEvent[] = [
  'rides:changed', 'rides:manual-registered',
  'financial:changed',
  'shift:changed', 'shift:started', 'shift:finished',
  'goals:changed',
  'detection:changed',
  'crm:changed',
  'xp:changed', 'xp:earned', 'level-up',
  'achievement:unlocked',
  'profile:changed',
  'invite:changed',
];

const listeners: Record<BusEvent, Set<Listener>> = Object.fromEntries(
  EVENTS.map(e => [e, new Set<Listener>()]),
) as Record<BusEvent, Set<Listener>>;

const version: Record<BusEvent, number> = Object.fromEntries(
  EVENTS.map(e => [e, 0]),
) as Record<BusEvent, number>;

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
