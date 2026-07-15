/**
 * XpService — Sprint 6 · Fase 2.
 *
 * ÚNICA API pública de XP. Consome xpRepository. Emite:
 *   - 'xp:changed' em toda mutação
 *   - 'xp:earned'  quando ganha XP > 0
 *   - 'level-up'   quando o nível sobe (bus sem payload; hooks releem)
 *
 * Também expõe o último ganho recente (para toasts) via getLastAward().
 * Não persiste histórico: apenas o valor mais recente em memória.
 */
import { xpRepository, type XpState } from '../repositories/xpRepository';
import { eventBus } from '../eventBus';
import { levelForXp, progressForXp, type LevelProgress } from '../gamification/levels';
import { telemetry } from '../telemetry';

export interface XpAward {
  amount: number;
  reason: string;         // 'achievement:<id>' | 'ride' | 'shift' | 'goal'
  atMs: number;
  levelUp: boolean;
  newLevel: number;
}

let lastAward: XpAward | null = null;

export const xpService = {
  get(): XpState { return xpRepository.read(); },

  progress(): LevelProgress {
    return progressForXp(xpRepository.read().totalXp);
  },

  getLastAward(): XpAward | null { return lastAward; },

  /**
   * Adiciona XP. Idempotente por chamada — quem chama é responsável por
   * evitar duplicidade (o engine de conquistas nunca chama para uma conquista
   * já desbloqueada).
   */
  addXp(amount: number, reason: string): XpAward | null {
    const delta = Math.max(0, Math.floor(amount));
    if (delta <= 0) return null;
    const before = xpRepository.read();
    const prevLevel = levelForXp(before.totalXp);
    const nextTotal = before.totalXp + delta;
    const nextLevel = levelForXp(nextTotal);
    const levelUp = nextLevel > prevLevel;

    xpRepository.write({ totalXp: nextTotal, updatedAt: new Date().toISOString() });
    lastAward = { amount: delta, reason, atMs: Date.now(), levelUp, newLevel: nextLevel };

    telemetry.recordGamification('xp_earned', delta);
    eventBus.emit('xp:earned');
    eventBus.emit('xp:changed');
    if (levelUp) {
      telemetry.recordGamification('level_up', nextLevel);
      eventBus.emit('level-up');
    }
    return lastAward;
  },

  /** Uso interno de testes / dataLifecycle. */
  reset(): void {
    xpRepository.reset();
    lastAward = null;
    eventBus.emit('xp:changed');
  },
};

export type XpProgress = LevelProgress;
