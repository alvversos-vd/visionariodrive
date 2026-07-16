/**
 * GamificationRepository — Sprint 6.2.5.
 *
 * Owner ÚNICO do payload de gamificação (XP + Conquistas + Stats snapshot).
 * Sincronizado via CloudSync através da chave 'vd-gamification', mapeada
 * para a coluna `user_data.gamification` (Supabase). Nenhuma tabela nova,
 * nenhum sincronizador paralelo — reutiliza o pipeline oficial.
 *
 * xpRepository e achievementRepository são adapters finos sobre este owner
 * (mantêm suas APIs públicas). Toda escrita passa por writeJson → markDirty,
 * então o CloudSync existente cuida do push/pull.
 */
import { readJson, writeJson } from './baseRepository';

export const GAMIFICATION_KEY = 'vd-gamification';
export const GAMIFICATION_SCHEMA_VERSION = 1;

export interface GamificationStatsSnapshot {
  rides?: number;
  distanceKm?: number;
  turns?: number;
  earnings?: number;
  longestShiftMinutes?: number;
  currentStreak?: number;
}

export interface GamificationAchievement {
  id: string;
  unlockedAt: string;
}

export interface GamificationPayload {
  schemaVersion: number;
  xp: { totalXp: number };
  achievements: GamificationAchievement[];
  stats: GamificationStatsSnapshot;
  updatedAt: string | null;
}

export function emptyGamification(): GamificationPayload {
  return {
    schemaVersion: GAMIFICATION_SCHEMA_VERSION,
    xp: { totalXp: 0 },
    achievements: [],
    stats: {},
    updatedAt: null,
  };
}

function coerce(raw: unknown): GamificationPayload {
  const base = emptyGamification();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const xpObj = r.xp && typeof r.xp === 'object' ? (r.xp as Record<string, unknown>) : {};
  const totalXp = Number(xpObj.totalXp);
  base.xp.totalXp = Number.isFinite(totalXp) && totalXp > 0 ? Math.floor(totalXp) : 0;

  const acRaw = Array.isArray(r.achievements) ? r.achievements : [];
  const seen = new Set<string>();
  for (const it of acRaw) {
    if (!it || typeof it !== 'object') continue;
    const id = String((it as Record<string, unknown>).id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const at = (it as Record<string, unknown>).unlockedAt;
    base.achievements.push({
      id,
      unlockedAt: typeof at === 'string' ? at : new Date().toISOString(),
    });
  }

  const statsRaw = r.stats && typeof r.stats === 'object' ? (r.stats as Record<string, unknown>) : {};
  const num = (v: unknown): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  base.stats = {
    rides: num(statsRaw.rides),
    distanceKm: num(statsRaw.distanceKm),
    turns: num(statsRaw.turns),
    earnings: num(statsRaw.earnings),
    longestShiftMinutes: num(statsRaw.longestShiftMinutes),
    currentStreak: num(statsRaw.currentStreak),
  };

  base.updatedAt = typeof r.updatedAt === 'string' ? r.updatedAt : null;
  base.schemaVersion = GAMIFICATION_SCHEMA_VERSION;
  return base;
}

/**
 * Merge determinístico entre dois payloads (local e cloud).
 *  - totalXp    → sempre o MAIOR (nunca reduz XP)
 *  - achievements → união por id, preservando o unlockedAt mais antigo
 *  - stats      → máximo campo a campo (streak/turno/faturamento nunca caem)
 *  - updatedAt  → o mais recente
 */
export function mergeGamification(
  a: GamificationPayload,
  b: GamificationPayload,
): { merged: GamificationPayload; hadConflict: boolean } {
  const xpTotal = Math.max(a.xp.totalXp, b.xp.totalXp);

  const byId = new Map<string, GamificationAchievement>();
  for (const it of [...a.achievements, ...b.achievements]) {
    const cur = byId.get(it.id);
    if (!cur) { byId.set(it.id, { ...it }); continue; }
    // preserva o desbloqueio mais antigo
    if (it.unlockedAt < cur.unlockedAt) byId.set(it.id, { ...it });
  }
  const achievements = [...byId.values()].sort((x, y) => x.unlockedAt.localeCompare(y.unlockedAt));

  const maxNum = (x?: number, y?: number): number | undefined => {
    if (x == null && y == null) return undefined;
    return Math.max(x ?? 0, y ?? 0);
  };
  const stats: GamificationStatsSnapshot = {
    rides: maxNum(a.stats.rides, b.stats.rides),
    distanceKm: maxNum(a.stats.distanceKm, b.stats.distanceKm),
    turns: maxNum(a.stats.turns, b.stats.turns),
    earnings: maxNum(a.stats.earnings, b.stats.earnings),
    longestShiftMinutes: maxNum(a.stats.longestShiftMinutes, b.stats.longestShiftMinutes),
    currentStreak: maxNum(a.stats.currentStreak, b.stats.currentStreak),
  };

  const updatedAt = [a.updatedAt, b.updatedAt]
    .filter((v): v is string => typeof v === 'string')
    .sort()
    .pop() ?? null;

  const hadConflict =
    a.xp.totalXp !== b.xp.totalXp ||
    a.achievements.length !== b.achievements.length ||
    achievements.length !== a.achievements.length ||
    achievements.length !== b.achievements.length;

  return {
    merged: { schemaVersion: GAMIFICATION_SCHEMA_VERSION, xp: { totalXp: xpTotal }, achievements, stats, updatedAt },
    hadConflict,
  };
}

export const gamificationRepository = {
  read(): GamificationPayload {
    return coerce(readJson<unknown>(GAMIFICATION_KEY, emptyGamification()));
  },

  write(payload: GamificationPayload, opts: { markCloud?: boolean; immediate?: boolean } = {}): void {
    const next = coerce(payload);
    next.updatedAt = new Date().toISOString();
    writeJson(GAMIFICATION_KEY, next, opts);
  },

  reset(): void {
    writeJson(GAMIFICATION_KEY, emptyGamification(), { markCloud: true });
  },

  /** Coerce+normalize arbitrary raw for merge use (CloudSync). */
  normalize(raw: unknown): GamificationPayload {
    return coerce(raw);
  },
};
