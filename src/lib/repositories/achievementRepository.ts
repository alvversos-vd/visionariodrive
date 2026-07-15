/**
 * AchievementRepository — Sprint 6 · Fase 2.
 *
 * Owner ÚNICO das conquistas desbloqueadas do motorista. Só armazena
 * {id, unlockedAt}. O catálogo (nome, ícone, XP) vive em gamification/catalog.
 */

const KEY = 'vd-achievements-v1';

export interface UnlockedAchievement {
  id: string;
  unlockedAt: string; // ISO
}

export interface AchievementState {
  unlocked: UnlockedAchievement[];
}

function empty(): AchievementState { return { unlocked: [] }; }

export const achievementRepository = {
  read(): AchievementState {
    if (typeof localStorage === 'undefined') return empty();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed?.unlocked) ? parsed.unlocked : [];
      const clean: UnlockedAchievement[] = [];
      const seen = new Set<string>();
      for (const it of arr) {
        const id = typeof it?.id === 'string' ? it.id : '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        clean.push({ id, unlockedAt: typeof it.unlockedAt === 'string' ? it.unlockedAt : new Date().toISOString() });
      }
      return { unlocked: clean };
    } catch { return empty(); }
  },
  write(state: AchievementState): void {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { /* noop */ }
  },
  reset(): void {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
  },
};
