/**
 * GoalsRepository — owner físico das metas.
 *
 * Delega para `storage.ts` (Shift ainda consome de lá). Fase 2 absorve.
 */

import {
  getGoal as legacyGetGoal,
  saveGoal as legacySaveGoal,
  getGoals as legacyGetGoals,
  saveGoals as legacySaveGoals,
} from '../storage';
import type { Goals, DailyGoal } from '../types';

export const goalsRepository = {
  get(): Goals { return legacyGetGoals(); },
  save(goals: Goals): void { legacySaveGoals(goals); },
  getDaily(): DailyGoal | null { return legacyGetGoal(); },
  saveDaily(goal: DailyGoal): void { legacySaveGoal(goal); },
};

export type { Goals, DailyGoal };
