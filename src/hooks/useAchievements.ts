/**
 * useAchievements — snapshot reativo (bloqueadas/desbloqueadas + progresso).
 */
import { useMemo } from 'react';
import { useBusVersion } from './useBusVersion';
import { achievementService, type Achievement } from '@/lib/services/achievementService';
import type { UnlockedAchievement } from '@/lib/repositories/achievementRepository';

export interface AchievementView {
  def: Achievement;
  unlocked: boolean;
  unlockedAt: string | null;
  progress: number; // 0..1
}

export function useAchievements(accountCreatedAt: string | null = null): {
  all: AchievementView[];
  unlocked: UnlockedAchievement[];
  totalXpFromAchievements: number;
} {
  useBusVersion('achievement:unlocked');
  useBusVersion('rides:changed');
  useBusVersion('shift:changed');
  useBusVersion('financial:changed');
  useBusVersion('goals:changed');

  return useMemo(() => {
    const unlockedList = achievementService.unlocked();
    const unlockedMap = new Map(unlockedList.map(u => [u.id, u.unlockedAt]));
    const ctx = achievementService.snapshotContext(accountCreatedAt);
    const all: AchievementView[] = achievementService.list().map(def => ({
      def,
      unlocked: unlockedMap.has(def.id),
      unlockedAt: unlockedMap.get(def.id) ?? null,
      progress: def.progress ? def.progress(ctx) : (def.condition(ctx) ? 1 : 0),
    }));
    const totalXp = all
      .filter(a => a.unlocked)
      .reduce((s, a) => s + a.def.xp, 0);
    return { all, unlocked: unlockedList, totalXpFromAchievements: totalXp };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountCreatedAt, achievementService.unlocked().length]);
}
