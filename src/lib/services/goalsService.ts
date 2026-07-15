/**
 * GoalsService — única API para metas. Consome APENAS goalsRepository.
 * Sprint 6: emite 'goals:changed' em toda mutação (alimenta engine de XP).
 */

import { goalsRepository, type Goals, type DailyGoal } from '../repositories/goalsRepository';
import { eventBus } from '../eventBus';

export const goalsService = {
  get(): Goals { return goalsRepository.get(); },
  save(goals: Goals): void {
    goalsRepository.save(goals);
    eventBus.emit('goals:changed');
  },
  getDaily(): number { return goalsRepository.get().daily; },
  saveDaily(amount: number): void {
    goalsRepository.saveDaily({ amount });
    eventBus.emit('goals:changed');
  },
  getSavingsDaily(): number { return goalsRepository.get().savingsDaily ?? 0; },
};

export type { Goals, DailyGoal };
