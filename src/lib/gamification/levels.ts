/**
 * Curva de níveis do Visionário Drive — Sprint 6 · Fase 2.
 *
 * Fórmula quadrática (progressiva mas suave):
 *   xpForLevel(n) = 50 * n * (n + 1)
 *
 *   Nível 0 → 0 XP
 *   Nível 1 → 100 XP     Nível 6  → 2100 XP
 *   Nível 2 → 300 XP     Nível 7  → 2800 XP
 *   Nível 3 → 600 XP     Nível 8  → 3600 XP
 *   Nível 4 → 1000 XP    Nível 9  → 4500 XP
 *   Nível 5 → 1500 XP    Nível 10 → 5500 XP
 */

const K = 50;

export function xpForLevel(level: number): number {
  const n = Math.max(0, Math.floor(level));
  return K * n * (n + 1);
}

export function levelForXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp));
  // resolve K*n*(n+1) <= xp   →   n = floor( (-1 + sqrt(1 + 4*xp/K)) / 2 )
  const n = Math.floor((-1 + Math.sqrt(1 + (4 * xp) / K)) / 2);
  return Math.max(0, n);
}

export interface LevelProgress {
  level: number;
  totalXp: number;
  currentLevelXp: number;   // XP dentro do nível atual
  nextLevelXp: number;      // XP necessário para o próximo nível (relativo)
  remainingXp: number;      // Quanto falta para o próximo nível
  pct: number;              // 0..1
}

export function progressForXp(totalXp: number): LevelProgress {
  const level = levelForXp(totalXp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const span = ceil - floor;
  const current = totalXp - floor;
  return {
    level,
    totalXp,
    currentLevelXp: current,
    nextLevelXp: span,
    remainingXp: Math.max(0, span - current),
    pct: span > 0 ? Math.max(0, Math.min(1, current / span)) : 0,
  };
}
