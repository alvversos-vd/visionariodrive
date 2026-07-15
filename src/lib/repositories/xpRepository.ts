/**
 * XpRepository — Sprint 6 · Fase 2.
 *
 * Owner ÚNICO do XP acumulado do motorista. Persistência local (offline-first,
 * mesmo padrão de rides/shifts). Cloud sync fica reservado para uma sub-sprint
 * posterior — a chave é estável e a estrutura versionada.
 *
 * Ninguém fora de xpService importa este arquivo.
 */

const KEY = 'vd-xp-v1';

export interface XpState {
  totalXp: number;
  updatedAt: string; // ISO
}

function empty(): XpState {
  return { totalXp: 0, updatedAt: new Date(0).toISOString() };
}

export const xpRepository = {
  read(): XpState {
    if (typeof localStorage === 'undefined') return empty();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const parsed = JSON.parse(raw);
      const total = Number(parsed?.totalXp);
      return {
        totalXp: Number.isFinite(total) && total >= 0 ? Math.floor(total) : 0,
        updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
      };
    } catch { return empty(); }
  },
  write(state: XpState): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(KEY, JSON.stringify({
        totalXp: Math.max(0, Math.floor(state.totalXp || 0)),
        updatedAt: state.updatedAt || new Date().toISOString(),
      }));
    } catch { /* storage cheio — silencia; XP não bloqueia app */ }
  },
  reset(): void {
    if (typeof localStorage === 'undefined') return;
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
  },
};
