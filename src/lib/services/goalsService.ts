/**
 * GoalsService — única API para metas. Consome APENAS goalsRepository.
 */

import { goalsRepository, type Goals, type DailyGoal } from '../repositories/goalsRepository';

export const goalsService = {
  get(): Goals { return goalsRepository.get(); },
  save(goals: Goals): void { goalsRepository.save(goals); },
  getDaily(): number { return goalsRepository.get().daily; },
  saveDaily(amount: number): void { goalsRepository.saveDaily({ amount }); },
  getSavingsDaily(): number { return goalsRepository.get().savingsDaily ?? 0; },
};

export type { Goals, DailyGoal };
