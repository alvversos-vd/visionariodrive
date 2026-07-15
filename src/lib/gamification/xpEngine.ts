/**
 * XpEngine — Sprint 6 · Fase 2.
 *
 * Orquestrador central de gamificação. Assina o EventBus e, em cada evento
 * relevante, delega ao achievementService.evaluate() (que credita XP).
 *
 *   EventBus  →  xpEngine  →  achievementService  →  xpService
 *
 * Zero componentes envolvidos. Zero polling. Zero timers.
 * Bootstrap em src/main.tsx via import de side-effect (start()).
 * O accountCreatedAt é fornecido dinamicamente por quem inicia (AuthContext
 * atualiza via setAccountContext ao carregar o profile).
 */
import { eventBus, type BusEvent } from '../eventBus';
import { achievementService } from '../services/achievementService';

const EVENTS: BusEvent[] = [
  'shift:started',
  'shift:finished',
  'shift:changed',            // fallback caso start/finished não sejam explicitados
  'rides:changed',
  'rides:manual-registered',
  'financial:changed',
  'goals:changed',
];

let started = false;
let unsubs: Array<() => void> = [];
let accountCreatedAt: string | null = null;
let scheduled = false;

function schedule() {
  if (scheduled) return;
  scheduled = true;
  // Coalesce bursts (múltiplos eventos no mesmo tick) em uma única avaliação.
  queueMicrotask(() => {
    scheduled = false;
    try { achievementService.evaluate(accountCreatedAt); } catch { /* engine nunca quebra o app */ }
  });
}

export const xpEngine = {
  start(): void {
    if (started) return;
    started = true;
    for (const ev of EVENTS) {
      unsubs.push(eventBus.subscribe(ev, schedule));
    }
    // Avaliação inicial após bootstrap (conquistas retroativas: founder/early_beta).
    schedule();
  },
  stop(): void {
    for (const u of unsubs) { try { u(); } catch { /* noop */ } }
    unsubs = [];
    started = false;
  },
  setAccountContext(createdAt: string | null): void {
    accountCreatedAt = createdAt ?? null;
    schedule();
  },
  isStarted(): boolean { return started; },
};
