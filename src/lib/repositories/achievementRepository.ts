/**
 * AchievementRepository — Sprint 6 · Fase 2 (Sprint 6.2.5: unificado sob
 * gamificationRepository). Mantém a API pública original.
 */
import { gamificationRepository } from './gamificationRepository';

export interface UnlockedAchievement {
  id: string;
  unlockedAt: string;
}

export interface AchievementState {
  unlocked: UnlockedAchievement[];
}

export const achievementRepository = {
  read(): AchievementState {
    const g = gamificationRepository.read();
    return { unlocked: g.achievements.map(a => ({ id: a.id, unlockedAt: a.unlockedAt })) };
  },
  write(state: AchievementState): void {
    const g = gamificationRepository.read();
    const seen = new Set<string>();
    g.achievements = [];
    for (const it of state.unlocked ?? []) {
      if (!it?.id || seen.has(it.id)) continue;
      seen.add(it.id);
      g.achievements.push({
        id: it.id,
        unlockedAt: typeof it.unlockedAt === 'string' ? it.unlockedAt : new Date().toISOString(),
      });
    }
    gamificationRepository.write(g);
  },
  reset(): void {
    const g = gamificationRepository.read();
    g.achievements = [];
    gamificationRepository.write(g);
  },
};
